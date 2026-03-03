# Phase 2: Content Conversion Engine - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert GSD's Claude-native skill, agent, and engine files into Copilot-compatible format during installation. Three source directories (`./commands/`, `./agents/`, `./get-shit-done/`) produce correctly formatted output in `.github/`.

</domain>

<decisions>
## Implementation Decisions

### Source Directories and Conversion Targets

- **`./commands/gsd/*.md`** → `.github/skills/gsd-*/SKILL.md` — skill conversion with frontmatter transformation
- **`./agents/gsd-*.md`** → `.github/agents/gsd-*.agent.md` — agent conversion with tools mapping and file rename
- **`./get-shit-done/`** → `.github/get-shit-done/` — full directory copy with path and command name transformations
- These are the ONLY 3 source directories for content conversion

### Tool Name Mapping (Agents ONLY)

Tool mapping applies **only to agents** — skills keep their original tool names unchanged.

Complete mapping table (deduplicated in output):

| Claude Tool | Copilot Tool |
|---|---|
| Read | read |
| Write | edit |
| Edit | edit |
| Bash | execute |
| Grep | search |
| Glob | search |
| Task | agent |
| WebSearch | web |
| WebFetch | web |
| TodoWrite | todo |
| AskUserQuestion | ask_user |
| SlashCommand | skill |
| mcp__context7__* | io.github.upstash/context7/* |

- When multiple Claude tools map to the same Copilot tool (Write/Edit→edit, Grep/Glob→search), **deduplicate** the output list
- Agent tools format: JSON array with lowercase names — `tools: ['read', 'edit', 'execute', 'search']`

### Skill Conversion Strategy

- **Copy body completely** — body content after frontmatter is identical
- **Transform frontmatter only:**
  - `name:` — convert `gsd:health` → `gsd-health` (colon to hyphen)
  - `allowed-tools:` — convert YAML array (multiline) to comma-separated string (single line)
  - `description:` and `argument-hint:` — no changes
- **Skills keep original tool names** — no mapping applied to `allowed-tools` values
- **Directory structure:** each skill in its own folder: `.github/skills/gsd-{name}/SKILL.md`

### Agent Conversion Strategy

- **Copy body completely** — body content is identical
- **Transform frontmatter:**
  - `tools:` — apply tool mapping table, convert to JSON array format, deduplicate
  - `name:` — already uses `gsd-` format (no conversion needed)
  - `description:` and `color:` — no changes, keep `color` even though Copilot ignores it
- **File rename:** `gsd-*.md` → `gsd-*.agent.md`

### Path Reference Conversion (CONV-06) — Global

Applied to ALL generated content (skills body, agents body, get-shit-done/ files):

- `~/.claude/` → `~/.copilot/` (global path)
- `./.claude/` → `./.github/` (local path with explicit prefix)
- `.claude/` → `.github/` (local path without prefix)

### Command Name Conversion (CONV-07) — Global

Applied to ALL generated content (skills frontmatter, skills body, agents body, get-shit-done/ files):

- `gsd:name` → `gsd-name` (colon to hyphen in all command references)
- This includes `/gsd:progress` → `/gsd-progress`, `gsd:health` → `gsd-health`, etc.

### Engine Directory (get-shit-done/)

- **Full copy** of `./get-shit-done/` → `.github/get-shit-done/`
- **Apply CONV-06 and CONV-07** to all files within (39 path references + 195+ command references found)
- Includes: `bin/`, `references/`, `templates/`, `workflows/`

### Router Skill (CONV-09) — DISCARDED

- The router skill at `.github/skills/get-shit-done/SKILL.md` is a legacy artifact
- It does NOT exist in the source (`commands/`) and should NOT be generated
- Individual skills (`gsd-*/SKILL.md`) are sufficient for Copilot's skill discovery
- **CONV-09 requirement is removed from this phase**

### CHANGELOG.md and VERSION (CONV-10)

- Written to `.github/get-shit-done/` during installation
- Behavior same as existing runtimes

### Claude's Discretion

- Order of conversion operations (skills first vs agents first)
- Error handling for malformed frontmatter
- Whether to use streaming or batch file processing
- Internal function naming for conversion utilities

</decisions>

<specifics>
## Specific Ideas

- The existing Copilot files in `.github/skills/` and `.github/agents/` can serve as reference/validation targets for the conversion output
- CONV-06 path mapping is context-dependent (global vs local) — not a simple find/replace of `.claude` → `.github`
- The `mcp__context7__*` wildcard pattern in tools needs to be handled as a glob-style match, not literal string

</specifics>

<deferred>
## Deferred Ideas

- **CONV-09 Router skill** — Discarded entirely, not deferred. Was a legacy implementation.
- **Hook conversion** — Copilot hooks exist but deferred to future milestone (from Phase 1 context)

</deferred>

---

*Phase: 02-content-conversion-engine*
*Context gathered: 2026-03-03*
