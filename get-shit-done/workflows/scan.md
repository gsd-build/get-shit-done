<purpose>
Rapid single-focus codebase analysis. Spawns one gsd-codebase-mapper agent for a targeted assessment.

Lighter than /gsd-map-codebase (1 agent, 1 focus area vs 4 parallel agents, 7 documents).

Output: .planning/codebase/ with documents for the selected focus area.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names):
- gsd-codebase-mapper -- Maps project structure and dependencies
</available_agent_types>

<process>

<step name="banner">
Display the scan banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SCANNING CODEBASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="parse_arguments">
Extract `--focus` value from `$ARGUMENTS`.

**Valid focus values:**
- `tech` -- Produces STACK.md, INTEGRATIONS.md
- `arch` -- Produces ARCHITECTURE.md, STRUCTURE.md
- `quality` -- Produces CONVENTIONS.md, TESTING.md
- `concerns` -- Produces CONCERNS.md
- `tech+arch` -- Produces STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md (DEFAULT)

If `--focus` is absent or not provided, set `FOCUS=tech+arch`.

If `--focus` value is not in the valid list above, display an error and stop:
```
GSD > Unknown focus area: "{value}"
GSD > Valid options: tech, arch, quality, concerns, tech+arch
```

This validation prevents unexpected behavior from invalid input.
</step>

<step name="check_existing">
Check if .planning/codebase/ already has documents for the target focus area:

```bash
ls .planning/codebase/ 2>/dev/null
```

**Map focus to expected files:**
- `tech` -- STACK.md, INTEGRATIONS.md
- `arch` -- ARCHITECTURE.md, STRUCTURE.md
- `quality` -- CONVENTIONS.md, TESTING.md
- `concerns` -- CONCERNS.md
- `tech+arch` -- STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md

If target files already exist, ask the user:

```
GSD > Found existing analysis for {FOCUS} focus area:
GSD > {list existing files}
GSD >
GSD > Refresh these documents? (yes/no)
```

If user says no, display the existing files with line counts and stop.
If user says yes (or no existing files), continue to next step.
</step>

<step name="ensure_directory">
Create the output directory if it does not exist:

```bash
mkdir -p .planning/codebase
```
</step>

<step name="spawn_mapper">
Spawn a single gsd-codebase-mapper agent for the resolved focus area.

Display before spawning:
```
◆ Spawning codebase mapper (focus: {FOCUS})...
```

Load agent skills:
```bash
AGENT_SKILLS_MAPPER=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-codebase-mapper 2>/dev/null)
```

**If FOCUS is `tech`:**

```
Task(
  subagent_type="gsd-codebase-mapper",
  description="Scan codebase: tech focus",
  prompt="Focus: tech

Analyze this codebase for technology stack and external integrations.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**If FOCUS is `arch`:**

```
Task(
  subagent_type="gsd-codebase-mapper",
  description="Scan codebase: arch focus",
  prompt="Focus: arch

Analyze this codebase architecture and directory structure.

Write these documents to .planning/codebase/:
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**If FOCUS is `quality`:**

```
Task(
  subagent_type="gsd-codebase-mapper",
  description="Scan codebase: quality focus",
  prompt="Focus: quality

Analyze this codebase for coding conventions and testing patterns.

Write these documents to .planning/codebase/:
- CONVENTIONS.md - Code style, naming, patterns, error handling
- TESTING.md - Framework, structure, mocking, coverage

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**If FOCUS is `concerns`:**

```
Task(
  subagent_type="gsd-codebase-mapper",
  description="Scan codebase: concerns focus",
  prompt="Focus: concerns

Analyze this codebase for technical debt, known issues, and areas of concern.

Write this document to .planning/codebase/:
- CONCERNS.md - Tech debt, bugs, security, performance, fragile areas

Explore thoroughly. Write document directly using template. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

**If FOCUS is `tech+arch` (default):**

```
Task(
  subagent_type="gsd-codebase-mapper",
  description="Scan codebase: tech+arch focus",
  prompt="Focus: tech and arch combined

Analyze this codebase for technology stack, external integrations, architecture, and directory structure.

Write these documents to .planning/codebase/:
- STACK.md - Languages, runtime, frameworks, dependencies, configuration
- INTEGRATIONS.md - External APIs, databases, auth providers, webhooks
- ARCHITECTURE.md - Pattern, layers, data flow, abstractions, entry points
- STRUCTURE.md - Directory layout, key locations, naming conventions

Explore thoroughly. Write documents directly using templates. Return confirmation only.
${AGENT_SKILLS_MAPPER}"
)
```

When the mapper completes, check for `## Mapping Complete` in the output. If missing, display a warning:
```
GSD > Warning: Mapper output may be incomplete (no completion marker found)
```
</step>

<step name="secret_scan">
**CRITICAL SECURITY CHECK:** Scan output files for accidentally leaked secrets before committing.

```bash
grep -E '(sk-[a-zA-Z0-9]{20,}|sk_live_|sk_test_|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|AKIA[A-Z0-9]{16}|-----BEGIN.*PRIVATE KEY|eyJ[a-zA-Z0-9_-]+\.eyJ)' .planning/codebase/*.md 2>/dev/null && echo "SECRETS_FOUND" || echo "CLEAN"
```

**If SECRETS_FOUND:**

```
GSD > SECURITY ALERT: Potential secrets detected in codebase documents!
GSD > [show grep output]
GSD >
GSD > Review the flagged content. Reply "safe to proceed" if not actually sensitive,
GSD > or edit the files to remove secrets first.
```

Wait for user confirmation before continuing.

**If CLEAN:**

Continue to commit step.
</step>

<step name="commit">
Commit the scanned documents:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(planning): scan codebase ({FOCUS})" --files .planning/codebase/
```
</step>

<step name="summary">
Display completion summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SCAN COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

List files written with line counts:
```bash
wc -l .planning/codebase/*.md
```

```
Scanned codebase (focus: {FOCUS}):
- {file1}.md ({N} lines)
- {file2}.md ({N} lines)
...
```

Display next steps:

```
───────────────────────────────────────────────────────────────

## ▶ Next Up

**Full coverage** -- map all 7 documents

`/gsd-map-codebase`

<sub>`/clear` first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- `/gsd-scan --focus quality` -- scan another area
- `/gsd-new-project` -- initialize project planning
- `/gsd-plan-phase` -- plan next phase

───────────────────────────────────────────────────────────────
```

End workflow.
</step>

</process>

<success_criteria>
- Single gsd-codebase-mapper agent spawned (NOT 4 parallel agents)
- Target documents written for the selected focus area
- No empty documents (each should have >20 lines)
- Secret scan completed before commit
- Clear completion summary with file list and line counts
- User offered next steps in GSD style
</success_criteria>
