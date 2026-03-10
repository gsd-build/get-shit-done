# Stack Research: Copilot CLI Runtime Support

**Domain:** Multi-runtime AI coding assistant installer — adding GitHub Copilot CLI as 5th runtime
**Researched:** 2025-03-02
**Confidence:** HIGH (based on existing working Copilot installation in this repo + installer source analysis)

## Recommended Stack

### No New Dependencies

The existing stack requires **zero changes**. Copilot CLI support is additive installer logic only.

| Technology | Version | Purpose | Change Needed |
|------------|---------|---------|---------------|
| Node.js (CommonJS) | >=16.7.0 | Installer runtime | None — keep `bin/install.js` as-is |
| `fs`, `path`, `os` | Built-in | File operations | None — same copy/transform pattern |
| `readline` | Built-in | Interactive prompts | Add "Copilot" to runtime selection menu |
| `crypto` | Built-in | Manifest hashing | None — same manifest pattern |

### What NOT to Change

| Component | Why Leave Alone |
|-----------|-----------------|
| `package.json` dependencies | Zero-dep constraint is sacred. Copilot needs no new packages. |
| Hook system (`hooks/dist/`) | Copilot CLI has no hook mechanism. Skip entirely. |
| `settings.json` logic | Copilot doesn't use `settings.json`. Skip entirely. |
| Existing 4 runtimes | Working. No changes to Claude/OpenCode/Gemini/Codex code paths. |
| `get-shit-done/` source content | Shared resources copy as-is (same as all runtimes). |
| `gsd-tools.cjs` and `lib/` | Unchanged — these are runtime-agnostic utilities. |

## Copilot CLI Extension Mechanism

### How Copilot CLI Discovers Content

Copilot CLI reads from the **repository's `.github/` directory**. This is fundamentally different from all other runtimes which use home-directory config folders.

**Discovery paths (all relative to repo root):**

| Path | Purpose | Auto-discovered |
|------|---------|-----------------|
| `.github/copilot-instructions.md` | System prompt (equivalent to `CLAUDE.md`) | Yes — always loaded |
| `.github/agents/*.agent.md` | Custom agent definitions | Yes — registered as spawnable agents |
| `.github/skills/*/SKILL.md` | Skill definitions (equivalent to commands) | Yes — available when referenced |

**Critical detail:** There is NO global install for Copilot CLI. It only reads from the current repository's `.github/` directory. The installer must handle this as **local-only**.

### File Structure Copilot Expects

```
.github/
├── copilot-instructions.md              # System prompt — instructs Copilot to use GSD
├── agents/
│   ├── gsd-executor.agent.md            # Note: .agent.md extension (NOT .md)
│   ├── gsd-planner.agent.md
│   ├── gsd-verifier.agent.md
│   └── ... (11 agent files)
├── skills/
│   ├── get-shit-done/
│   │   └── SKILL.md                     # Main GSD skill — routing hub
│   ├── gsd-new-project/
│   │   └── SKILL.md                     # Individual command skills
│   ├── gsd-plan-phase/
│   │   └── SKILL.md
│   └── ... (31 skill directories)
└── get-shit-done/                       # Shared resources (workflows, templates, references, bin)
    ├── bin/gsd-tools.cjs
    ├── bin/lib/*.cjs
    ├── workflows/*.md
    ├── templates/**/*.md
    └── references/*.md
```

### Agent File Format (.agent.md)

```yaml
---
name: gsd-executor
description: Executes GSD plans with atomic commits...
tools: ['read', 'edit', 'edit', 'execute', 'search', 'search']
color: yellow
---

<role>
You are a GSD plan executor...
</role>
```

**Key differences from Claude Code agents:**
- File extension is `.agent.md` (not `.md`)
- Tools use Copilot CLI names in YAML array format (not Claude Code PascalCase)
- Same frontmatter fields otherwise (name, description, tools, color)

### Skill File Format (SKILL.md)

```yaml
---
name: gsd-plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: '<phase-number> [--auto]'
agent: gsd-planner
allowed-tools: Read, Write, Bash, Glob, Grep, Task, WebFetch
---

<objective>
...
</objective>

<execution_context>
@.github/get-shit-done/workflows/plan-phase.md
</execution_context>
```

**Key differences from source commands:**
- Command name uses hyphens: `gsd-plan-phase` (not `gsd:plan-phase`)
- `allowed-tools` is flat comma-separated (not YAML array)
- Path references use `@.github/get-shit-done/` (not `@~/.claude/get-shit-done/`)
- No `<codex_skill_adapter>` or `<codex_agent_role>` headers (unlike Codex)
- `$ARGUMENTS` is kept as-is (not converted to `{{GSD_ARGS}}` like Codex)

## Tool Name Mapping: Claude Code → Copilot CLI

| Claude Code | Copilot CLI | Notes |
|-------------|-------------|-------|
| `Read` | `read` | |
| `Write` | `edit` | Write maps to edit (same as Edit) |
| `Edit` | `edit` | |
| `Bash` | `execute` | |
| `Grep` | `search` | Both Grep and Glob → search |
| `Glob` | `search` | |
| `WebSearch` | `websearch` | |
| `WebFetch` | `webfetch` | |
| `Task` | (omit) | Agents are auto-discoverable |
| `TodoWrite` | (omit or keep) | May not have direct equivalent |
| `AskUserQuestion` | `ask_user` | Per copilot-instructions.md |
| `mcp__context7__*` | `mcp__context7__*` | MCP tools keep their format |

**Important:** This mapping applies to **agent frontmatter `tools:` field only**. Skill `allowed-tools:` keeps Claude Code names (these are parsed differently by the runtime).

## Integration Points with Existing Installer

### Changes to `bin/install.js`

The installer follows a clear pattern for each runtime. Copilot requires the same pattern with these specifics:

#### 1. Argument Parsing (lines 37–59)

Add `--copilot` flag and include in `--all`:

```javascript
const hasCopilot = args.includes('--copilot');

// In --all block:
selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'copilot'];

// In individual flags block:
if (hasCopilot) selectedRuntimes.push('copilot');
```

#### 2. Directory Resolution (lines 62–88)

Copilot always targets `.github/` — not a home directory:

```javascript
function getDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  // ... existing cases
}
```

**Critical:** `getGlobalDir()` and `getConfigDirFromHome()` are **not applicable** for Copilot. The `install()` function's `targetDir` logic needs a Copilot-specific path:
- There is no global install for Copilot — it's always `path.join(process.cwd(), '.github')`
- The installer should either force local-only or treat "global" as a no-op/error for Copilot

#### 3. Command Conversion (install function, lines 1862–1900)

Copilot uses the same skill directory structure as Codex (`skills/gsd-*/SKILL.md`) but with **different content conversion**:

```javascript
} else if (isCopilot) {
  const skillsDir = path.join(targetDir, 'skills');
  const gsdSrc = path.join(src, 'commands', 'gsd');
  copyCommandsAsCopilotSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
}
```

Need a new `convertClaudeCommandToCopilotSkill()` function that:
- Converts `gsd:name` → `gsd-name` in command name
- Converts `allowed-tools` from YAML array to flat comma-separated
- Replaces path references `@~/.claude/` → `@.github/`
- Does NOT add `<codex_skill_adapter>` header
- Keeps `$ARGUMENTS` as-is (no `{{GSD_ARGS}}` conversion)

#### 4. Agent Conversion (lines 1912–1951)

Need a new `convertClaudeAgentToCopilotAgent()` function that:
- Maps Claude tool names → Copilot tool names (see mapping table above)
- Outputs as YAML array: `tools: ['read', 'edit', 'execute']`
- Does NOT add `<codex_agent_role>` header
- Does NOT generate `.toml` files

**Files must be written with `.agent.md` extension** (not `.md`):
```javascript
fs.writeFileSync(path.join(agentsDest, `${name}.agent.md`), content);
```

#### 5. copilot-instructions.md Generation

The installer must generate or copy `copilot-instructions.md` to `.github/`:
```javascript
const instructionsSrc = /* source template */;
const instructionsDest = path.join(targetDir, 'copilot-instructions.md');
```

This file is the equivalent of what `settings.json` hooks do for Claude/Gemini — it tells Copilot how to discover and use GSD skills.

#### 6. Skip Hooks and Settings (lines 1975–2011)

Like Codex, Copilot needs NO hooks, NO `settings.json`, NO statusline, NO `package.json` CommonJS hack:

```javascript
if (!isCodex && !isCopilot) {
  // hooks, settings.json, package.json logic
}
```

#### 7. Skip config.toml (lines 2025–2030)

Unlike Codex, Copilot needs NO `config.toml` generation:

```javascript
if (isCodex) {
  // Generate config.toml... (existing)
} else if (isCopilot) {
  // No config.toml needed
  return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
}
```

#### 8. get-shit-done Skill Hub

The installer must also create the `get-shit-done` routing skill at `.github/skills/get-shit-done/SKILL.md`. This is the master skill that tells Copilot how to route `/gsd-*` invocations to individual skill files.

#### 9. Uninstall Logic (lines 1200–1300)

Add Copilot-specific uninstall that:
- Removes `.github/skills/gsd-*/` directories
- Removes `.github/skills/get-shit-done/` directory
- Removes `.github/agents/gsd-*.agent.md` files
- Removes `.github/get-shit-done/` directory
- Removes GSD sections from `.github/copilot-instructions.md` (or removes file if GSD-only)
- Does NOT touch `.github/workflows/`, `.github/CODEOWNERS`, etc.

#### 10. Interactive Prompt (lines 2202–2241)

Add option 5 for Copilot, shift "All" to 6:

```
  1) Claude Code (~/.claude)
  2) OpenCode    (~/.config/opencode)
  3) Gemini      (~/.gemini)
  4) Codex       (~/.codex)
  5) Copilot     (.github/)
  6) All
```

**Note:** When "All" includes Copilot, the location prompt needs to handle that Copilot is always local while others can be global. Either: (a) install Copilot locally while installing others globally, or (b) prompt separately for Copilot.

#### 11. Manifest Generation

The manifest should use `"platform": "copilot"` and `"scope": "local"` (always local).

## Conversion Functions Needed

| Function | Purpose | Similarity To |
|----------|---------|---------------|
| `convertClaudeCommandToCopilotSkill()` | Convert source command → Copilot SKILL.md | Similar to `convertClaudeCommandToCodexSkill()` but simpler (no adapter header) |
| `convertClaudeAgentToCopilotAgent()` | Convert source agent → Copilot .agent.md | Similar to `convertClaudeAgentToCodexAgent()` but different tool mapping, no role header |
| `convertCopilotToolName()` | Map Claude tool names to Copilot names | Similar to `convertToolName()` / `convertGeminiToolName()` |
| `copyCommandsAsCopilotSkills()` | Copy commands as skill directories | Fork of `copyCommandsAsCodexSkills()` using Copilot converter |
| `generateCopilotInstructions()` | Generate copilot-instructions.md | New — no equivalent in other runtimes |

## Path Reference Replacement

| Source Path | Copilot Path |
|-------------|--------------|
| `~/.claude/get-shit-done/` | `.github/get-shit-done/` |
| `./.claude/get-shit-done/` | `.github/get-shit-done/` |
| `~/.codex/get-shit-done/` | `.github/get-shit-done/` |
| `/gsd:command-name` | `/gsd-command-name` |

The `pathPrefix` for Copilot should be `.github/`.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Add Copilot as 5th runtime in `install.js` | Separate `install-copilot.js` script | Violates existing multi-runtime architecture. All runtimes share one installer. |
| Local-only install for Copilot | Support both global and local | Copilot CLI only reads from `.github/` — global doesn't apply. |
| Fork Codex conversion functions | Reuse Codex functions with flags | Copilot format is simpler than Codex (no adapter headers, no TOML configs). Forking is cleaner than adding flag spaghetti. |
| Generate `copilot-instructions.md` from template | Let user write it manually | Other runtimes auto-configure their equivalents (settings.json, config.toml). Copilot should too. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Codex adapter headers (`<codex_skill_adapter>`) | Copilot doesn't need/understand them | Plain SKILL.md with converted frontmatter |
| Codex config.toml generation | Copilot has no config.toml equivalent | `copilot-instructions.md` for system instructions |
| `{{GSD_ARGS}}` variable syntax | That's Codex-specific | Keep `$ARGUMENTS` as-is for Copilot |
| Home directory paths for Copilot | Copilot reads from repo `.github/` only | Always use `process.cwd() + '.github/'` |
| Global install mode for Copilot | No global config directory exists | Force local-only, error/warn on `--copilot --global` |

## Copilot-Specific Patterns

### Slash Command Routing

Copilot CLI does NOT support custom slash commands natively. Instead, GSD uses a skill-based routing pattern:

1. `copilot-instructions.md` tells Copilot to treat `/gsd-*` as command invocations
2. The `get-shit-done` skill (`skills/get-shit-done/SKILL.md`) explains the routing
3. Each command is a separate skill in `skills/gsd-*/SKILL.md`

This is already working in the existing `.github/` files — the installer just needs to generate it.

### Subagent Spawning

Copilot CLI uses `.github/agents/*.agent.md` for subagent definitions. When a skill says "spawn subagent gsd-planner", Copilot automatically finds `.github/agents/gsd-planner.agent.md`.

Per `copilot-instructions.md`: "When a command says to spawn a subagent, prefer a matching custom agent from `.github/agents`."

### Tool Mapping in Content

Skill/workflow content may reference Claude Code tool names (e.g., "use the Bash tool"). The `copilot-instructions.md` provides runtime translation:
- "Bash tool" → use the execute tool
- "Read/Write" → use read/edit tools
- "AskUserQuestion" → ask directly in chat

This means **workflow content does NOT need tool name conversion** — only agent frontmatter `tools:` fields need conversion.

## Version Compatibility

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| Node.js | >=16.7.0 | Same as existing. No new APIs needed. |
| GitHub Copilot CLI | Current | No version-specific API dependencies. File-based discovery is stable. |
| npm package | 1.23.0 (target) | Copilot support will be the primary feature of v1.23. |

## Sources

- `.github/copilot-instructions.md` — Copilot system prompt format (HIGH confidence, direct evidence)
- `.github/agents/gsd-*.agent.md` — Agent file format and tool mapping (HIGH confidence, working examples)
- `.github/skills/*/SKILL.md` — Skill file format (HIGH confidence, working examples)
- `.github/get-shit-done/.gsd-install-manifest.json` — Manifest format with `platform: "copilot"` (HIGH confidence)
- `bin/install.js` — Existing installer patterns for 4 runtimes (HIGH confidence, source code analysis)
- `.github/skills/get-shit-done/SKILL.md` — Routing skill pattern (HIGH confidence, working example)
- `.gitignore` — Confirms `.github/agents/gsd-*`, `.github/skills/gsd-*`, `.github/get-shit-done/*` are generated files (HIGH confidence)

---
*Stack research for: Copilot CLI runtime installer support*
*Researched: 2025-03-02*
