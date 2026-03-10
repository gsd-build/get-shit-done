# Architecture Patterns

**Domain:** Multi-runtime AI coding assistant installer — Copilot CLI integration
**Researched:** 2025-03-02
**Confidence:** HIGH — based on direct source code analysis of install.js (2376 lines), existing Copilot reference implementation in `.github/`, and all 4 existing runtime patterns.

## Recommended Architecture

Copilot is the 5th runtime but architecturally unique: it is **local-only** (installs to `.github/` in the repo, never a global `~/.copilot/` directory) and uses **Copilot-specific naming conventions** (`.agent.md` suffix for agents, `skills/` with `SKILL.md` files, `copilot-instructions.md` for global instructions).

The install should follow the existing Codex pattern most closely (skill directories with SKILL.md files), but with Copilot-specific path replacement (`~/.claude/` → `.github/`), agent file renaming (`gsd-*.md` → `gsd-*.agent.md`), and a generated `copilot-instructions.md` file replacing the `settings.json` hook system.

### Architecture Overview

```
bin/install.js
├── CLI flags: --copilot added to runtime selection
├── getDirName('copilot')        → '.github'
├── getGlobalDir('copilot')      → ERROR: local-only, guard against --global
├── getConfigDirFromHome(...)    → "'.github'" (local path pattern)
├── install('copilot')
│   ├── Commands: copyCommandsAsCopilotSkills()   [NEW FUNCTION]
│   │   └── commands/gsd/*.md → .github/skills/gsd-*/SKILL.md
│   ├── Core:    copyWithPathReplacement()         [EXISTING, path swap only]
│   │   └── get-shit-done/ → .github/get-shit-done/
│   ├── Agents:  convertClaudeAgentToCopilotAgent() [NEW FUNCTION]
│   │   └── agents/gsd-*.md → .github/agents/gsd-*.agent.md
│   ├── Router:  generateCopilotRouterSkill()      [NEW FUNCTION]
│   │   └── (generated) → .github/skills/get-shit-done/SKILL.md
│   ├── Instructions: generateCopilotInstructions() [NEW FUNCTION]
│   │   └── (generated) → .github/copilot-instructions.md
│   ├── NO hooks (no settings.json, no statusline, no update check)
│   ├── NO package.json (CommonJS marker not needed)
│   └── NO config.toml (unlike Codex)
├── uninstall('copilot')
│   ├── Remove .github/skills/gsd-* directories
│   ├── Remove .github/skills/get-shit-done/ router skill
│   ├── Remove .github/agents/gsd-*.agent.md files
│   ├── Remove .github/get-shit-done/ directory
│   ├── Remove .github/copilot-instructions.md
│   └── Preserve non-GSD .github/ content (workflows, CODEOWNERS, etc.)
└── writeManifest('copilot')     [EXISTING, extend for new paths]
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `bin/install.js` — CLI flags | Parse `--copilot`, add to `selectedRuntimes`, update `--all` | Runtime selection logic |
| `getDirName()` | Return `.github` for copilot | `install()`, `uninstall()`, path construction |
| `getGlobalDir()` | **Guard**: reject copilot with `--global` (local-only) | CLI validation |
| `install()` — copilot branch | Orchestrate file copying, conversion, generation | All copy/convert functions |
| `convertClaudeCommandToCopilotSkill()` | Convert Claude command → Copilot skill format | `copyCommandsAsCopilotSkills()` |
| `convertClaudeAgentToCopilotAgent()` | Convert agent frontmatter + body for Copilot | `install()` agent copy loop |
| `generateCopilotRouterSkill()` | Generate `get-shit-done` meta-skill | `install()` |
| `generateCopilotInstructions()` | Generate `copilot-instructions.md` | `install()` |
| `uninstall()` — copilot branch | Clean Copilot-specific files from `.github/` | File system |
| `writeManifest()` — copilot branch | Track installed files for patch detection | `saveLocalPatches()` |

### Data Flow — Copilot Installation

```
User: npx get-shit-done-cc --copilot --local
  │
  ├── 1. Validate: copilot + --global → ERROR
  │                copilot + --local  → OK (or prompt, default to local)
  │
  ├── 2. Resolve targetDir: path.join(process.cwd(), '.github')
  │      Resolve pathPrefix: './.github/'
  │
  ├── 3. Save local patches (if manifest exists from prior install)
  │
  ├── 4. Copy commands → skills
  │      FOR EACH commands/gsd/*.md:
  │        Read source → replace paths → convert to Copilot skill format
  │        Write → .github/skills/gsd-<name>/SKILL.md
  │
  ├── 5. Generate router skill
  │      Write → .github/skills/get-shit-done/SKILL.md (static content)
  │
  ├── 6. Copy get-shit-done core (with path replacement)
  │      get-shit-done/ → .github/get-shit-done/
  │      Replace: ~/.claude/ → ./.github/  (and $HOME/.claude → .github)
  │
  ├── 7. Copy agents (with conversion)
  │      FOR EACH agents/gsd-*.md:
  │        Read source → replace paths → convert frontmatter + body
  │        Write → .github/agents/gsd-<name>.agent.md  (note: .agent.md suffix!)
  │
  ├── 8. Generate copilot-instructions.md
  │      Write → .github/copilot-instructions.md
  │
  ├── 9. Write VERSION + CHANGELOG
  │      .github/get-shit-done/VERSION
  │      .github/get-shit-done/CHANGELOG.md
  │
  ├── 10. Write manifest for patch detection
  │
  └── 11. Print completion (skip statusline prompt, skip hooks)
```

## Functions That Need Changes (Existing)

### 1. CLI Flag Parsing (lines 37-59)

**What changes:** Add `--copilot` flag, update `--all` to include `'copilot'`.

```javascript
const hasCopilot = args.includes('--copilot');

if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'copilot'];
}
if (hasCopilot) selectedRuntimes.push('copilot');
```

### 2. `getDirName()` (lines 62-67)

**What changes:** Add copilot case.

```javascript
if (runtime === 'copilot') return '.github';
```

**Note:** `.github` is fundamentally different from other runtimes — it's a shared directory that may already contain non-GSD files (workflows, CODEOWNERS, etc.). The installer MUST NOT use `fs.rmSync()` on `.github/` during clean install. It must only manage GSD-specific subdirectories.

### 3. `getGlobalDir()` (lines 121-160)

**What changes:** Add copilot guard. Copilot has no global mode.

```javascript
if (runtime === 'copilot') {
  // Copilot is local-only — files go in .github/ inside the repo
  // There is no global ~/.copilot/ equivalent
  if (explicitDir) return expandTilde(explicitDir);
  return path.join(process.cwd(), '.github');
}
```

**Alternative:** Throw an error if `--copilot --global` is used. This is cleaner.

### 4. `getConfigDirFromHome()` (lines 75-89)

**What changes:** Add copilot case. Since Copilot is local-only, the path is always relative.

```javascript
if (runtime === 'copilot') return "'.github'";
```

### 5. `install()` (lines 1823-2106)

**What changes:** Add copilot branch in multiple switch points:
- **Commands section** (lines 1862-1900): Add `isCopilot` branch similar to `isCodex` but using Copilot-specific conversion
- **Agents section** (lines 1912-1952): Add Copilot conversion path with `.agent.md` suffix rename
- **Post-install section** (lines 1975-2011): Skip hooks, package.json, and config.toml for Copilot
- **Label**: Add `if (isCopilot) runtimeLabel = 'GitHub Copilot CLI'`
- **Generate `copilot-instructions.md`** and **router skill** (new steps)

### 6. `uninstall()` (lines 1205-1492)

**What changes:** Add `isCopilot` branch:
- Remove `.github/skills/gsd-*` directories
- Remove `.github/skills/get-shit-done/` router skill
- Remove `.github/agents/gsd-*.agent.md` files
- Remove `.github/get-shit-done/` directory
- Remove `.github/copilot-instructions.md` (only if it's GSD-generated)
- **CRITICAL:** Do NOT remove `.github/` itself or non-GSD files within it

### 7. `writeManifest()` (lines 1703-1749)

**What changes:** Add copilot branch to track:
- `skills/gsd-*/SKILL.md` files
- `skills/get-shit-done/SKILL.md` router
- `agents/gsd-*.agent.md` files
- `get-shit-done/` core directory
- `copilot-instructions.md`

### 8. `promptRuntime()` (lines 2202-2241)

**What changes:** Add Copilot as option 5, renumber "All" to 6.

```
  5) Copilot    (.github/) - GitHub Copilot CLI
  6) All
```

### 9. `reportLocalPatches()` (lines 1795-1821)

**What changes:** Add copilot reapply command format.

```javascript
: runtime === 'copilot'
  ? '/gsd-reapply-patches'  // Copilot uses /gsd- prefix like OpenCode
```

### 10. `finishInstall()` (lines 2111-2146)

**What changes:** Handle copilot case: skip statusline, skip settings.json write.

### 11. Banner and Help (lines 162-208)

**What changes:** Update banner text to include "Copilot" in the runtime list. Add `--copilot` to help examples.

### 12. `getCommitAttribution()` (lines 259-298)

**What changes:** Add copilot case (likely returns `undefined` — no attribution setting).

## New Functions Needed

### 1. `convertClaudeCommandToCopilotSkill(content, skillName)`

**Purpose:** Convert Claude command markdown to Copilot skill format.

**Transformations (derived from diff analysis of existing Claude commands vs Copilot skills):**
- Replace `name: gsd:foo-bar` → `name: gsd-foo-bar` (colon to hyphen)
- Collapse `allowed-tools:` YAML array to single-line comma-separated
- Replace `~/.claude/` paths → `.github/` paths
- Replace `/gsd:` slash command references → `/gsd-`
- Replace `$HOME/.claude/` → `.github/`
- Remove `analysis_paralysis_guard` blocks (Copilot doesn't support this pattern)
- Keep YAML frontmatter structure (name, description, argument-hint, allowed-tools)

**Differences from Codex conversion:**
- No `<codex_skill_adapter>` header needed
- No `$ARGUMENTS → {{GSD_ARGS}}` replacement
- Keeps standard YAML frontmatter instead of Codex-specific format
- Path prefix is `.github/` not `.codex/`

### 2. `copyCommandsAsCopilotSkills(srcDir, skillsDir, prefix, pathPrefix, runtime)`

**Purpose:** Copy commands as Copilot skill directories (mirroring `copyCommandsAsCodexSkills` pattern).

**Structure:** Each command becomes `skills/gsd-<name>/SKILL.md`, same directory layout as Codex.

### 3. `convertClaudeAgentToCopilotAgent(content)`

**Purpose:** Convert Claude agent format to Copilot agent format.

**Transformations:**
- Replace `tools: Read, Write, Edit, Bash, Grep, Glob` → `tools: ['read', 'edit', 'edit', 'execute', 'search', 'search']` (Copilot tool names)
- Replace `~/.claude/` → `.github/`
- Replace `$HOME/.claude/` → `.github/`
- Replace `/gsd:` → `/gsd-`
- Replace `.claude/skills/` → `.agents/skills/`
- Remove `<analysis_paralysis_guard>` blocks
- Keep blank line after frontmatter (Copilot format adds one extra blank line)

**Tool name mapping (Claude → Copilot):**

| Claude | Copilot |
|--------|---------|
| Read | read |
| Write | edit |
| Edit | edit |
| Bash | execute |
| Grep | search |
| Glob | search |
| Task | (keep or map to agent spawn) |
| AskUserQuestion | ask_user |
| TodoWrite | (keep or remove) |
| WebFetch | (remove — Copilot may not have this) |
| WebSearch | (remove — Copilot may not have this) |

**Note:** The tool mapping needs verification against actual Copilot CLI capabilities. The existing Copilot agents in `.github/agents/` use `['read', 'edit', 'edit', 'execute', 'search', 'search']` which suggests a fixed mapping was already determined.

### 4. `generateCopilotRouterSkill()`

**Purpose:** Generate the `get-shit-done` meta-skill that routes `/gsd-*` commands to individual skills.

**Content:** Static markdown (see `.github/skills/get-shit-done/SKILL.md` for reference). This is a router that tells Copilot how to find and load GSD skills.

### 5. `generateCopilotInstructions()`

**Purpose:** Generate `.github/copilot-instructions.md` — the Copilot equivalent of `settings.json` instructions.

**Content:** Static markdown (see existing file for reference). 7 lines of instructions telling Copilot to use GSD skills when invoked.

## File Mapping: Source → Destination

### Commands → Skills

| Source | Destination | Conversion |
|--------|-------------|------------|
| `commands/gsd/new-project.md` | `.github/skills/gsd-new-project/SKILL.md` | `convertClaudeCommandToCopilotSkill()` |
| `commands/gsd/execute-phase.md` | `.github/skills/gsd-execute-phase/SKILL.md` | Same |
| `commands/gsd/*.md` (all ~32 files) | `.github/skills/gsd-*/SKILL.md` | Same pattern |

### Agents

| Source | Destination | Conversion |
|--------|-------------|------------|
| `agents/gsd-executor.md` | `.github/agents/gsd-executor.agent.md` | `convertClaudeAgentToCopilotAgent()` + rename to `.agent.md` |
| `agents/gsd-planner.md` | `.github/agents/gsd-planner.agent.md` | Same |
| `agents/gsd-*.md` (all 11 files) | `.github/agents/gsd-*.agent.md` | Same pattern |

### Core Engine

| Source | Destination | Conversion |
|--------|-------------|------------|
| `get-shit-done/` (entire tree) | `.github/get-shit-done/` | `copyWithPathReplacement()` with `.github/` prefix |
| `get-shit-done/bin/gsd-tools.cjs` | `.github/get-shit-done/bin/gsd-tools.cjs` | Path replacement only |
| `get-shit-done/workflows/*.md` | `.github/get-shit-done/workflows/*.md` | Path replacement only |
| `get-shit-done/references/*.md` | `.github/get-shit-done/references/*.md` | Path replacement only |
| `get-shit-done/templates/*.md` | `.github/get-shit-done/templates/*.md` | Path replacement only |

### Generated Files

| Source | Destination | Method |
|--------|-------------|--------|
| (generated) | `.github/skills/get-shit-done/SKILL.md` | `generateCopilotRouterSkill()` |
| (generated) | `.github/copilot-instructions.md` | `generateCopilotInstructions()` |
| `CHANGELOG.md` | `.github/get-shit-done/CHANGELOG.md` | Direct copy |
| (generated) | `.github/get-shit-done/VERSION` | Write version string |

### Files NOT Copied (Copilot differences)

| Component | Why Not |
|-----------|---------|
| Hooks (`hooks/dist/*.js`) | Copilot has no hook system |
| `package.json` (CommonJS marker) | Not needed — Copilot doesn't run JS in same way |
| `settings.json` | Copilot uses `copilot-instructions.md` instead |
| `config.toml` | Codex-only |

## Integration Points with Hook System

**Copilot has NO hook integration.** This is a key architectural difference:

- **No `settings.json`** — Copilot doesn't use this file
- **No `SessionStart` hooks** — No update check on start
- **No `PostToolUse` hooks** — No context monitor
- **No statusline** — Copilot CLI doesn't support custom statuslines

The `finishInstall()` function should short-circuit for Copilot (similar to Codex, which also returns early before hook setup).

## Patterns to Follow

### Pattern 1: Parallel to Codex (Closest Analog)

**What:** Copilot follows the Codex pattern most closely — same skill directory structure (`skills/gsd-*/SKILL.md`), same concept of converted-from-Claude source commands.

**When:** Use this as the template for all Copilot install logic.

**Key difference from Codex:** Copilot doesn't need the `<codex_skill_adapter>` header in skills, doesn't need `config.toml`, and agents use `.agent.md` suffix instead of `.toml` config.

### Pattern 2: Safe .github/ Directory Management

**What:** The `.github/` directory is shared with other GitHub features (workflows, issue templates, CODEOWNERS, etc.). The installer must ONLY touch GSD-managed subdirectories.

**When:** Always, for both install and uninstall.

**Rules:**
1. Never `fs.rmSync('.github/', { recursive: true })` — this would delete CI/CD configs
2. Only manage: `skills/gsd-*`, `skills/get-shit-done`, `agents/gsd-*.agent.md`, `get-shit-done/`, `copilot-instructions.md`
3. Clean install means removing GSD-specific items then recreating, NOT wiping the parent directory
4. `copyWithPathReplacement()` already handles this for `get-shit-done/` subdirectory — that pattern is safe

### Pattern 3: Local-Only Runtime Guard

**What:** Copilot is the first local-only runtime. Global install doesn't make sense because `.github/` is repo-specific.

**When:** At CLI validation time.

**Implementation:**
```javascript
// In install() or main logic
if (runtime === 'copilot' && isGlobal) {
  console.error('  Copilot installs to .github/ in the project — use --local');
  process.exit(1);
}
```

**Interactive prompt:** When user selects Copilot, skip the global/local prompt and default to local. Or show the prompt but clearly explain.

### Pattern 4: Path Replacement Strategy

**What:** All existing runtimes replace `~/.claude/` with their target prefix. Copilot replaces with `.github/`.

**Differences from other runtimes:**
- Claude global: `~/.claude/` → `~/.claude/` (unchanged)
- Claude local: `~/.claude/` → `./.claude/`
- OpenCode global: `~/.claude/` → `~/.config/opencode/`
- Codex global: `~/.claude/` → `~/.codex/`
- **Copilot local: `~/.claude/` → `./.github/`**

Also needs: `$HOME/.claude/` → `.github/` (without `./` prefix, for bash code blocks in agents/workflows)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Wiping .github/ on Install

**What:** Using `fs.rmSync(targetDir, { recursive: true })` where targetDir is `.github/`
**Why bad:** Destroys GitHub Actions workflows, issue templates, CODEOWNERS, etc.
**Instead:** Only remove GSD-specific subdirectories/files, then create/replace them individually.

### Anti-Pattern 2: Treating Copilot as Global-Capable

**What:** Allowing `--copilot --global` and writing to some `~/.copilot/` directory
**Why bad:** Copilot CLI reads from `.github/` in the repo. A global install would be ignored.
**Instead:** Error with clear message, or silently default to local with a warning.

### Anti-Pattern 3: Exact Codex Copy Without Adaptation

**What:** Reusing `copyCommandsAsCodexSkills()` unchanged for Copilot
**Why bad:** Codex skills have `<codex_skill_adapter>` headers, `$ARGUMENTS` → `{{GSD_ARGS}}` replacements, and Codex-specific tool mappings that don't apply to Copilot.
**Instead:** Create a dedicated `convertClaudeCommandToCopilotSkill()` that produces cleaner output matching the reference Copilot skills.

### Anti-Pattern 4: Agent Rename Without Content Conversion

**What:** Just renaming `gsd-*.md` → `gsd-*.agent.md` without converting tool names and paths
**Why bad:** Copilot uses different tool names (`read` not `Read`, `execute` not `Bash`) and different paths.
**Instead:** Full conversion: path replacement + tool mapping + format adjustments.

## Scalability Considerations

| Concern | Current (5 runtimes) | At 7+ runtimes |
|---------|----------------------|-----------------|
| Switch/if chains | Growing but manageable | Extract runtime config objects |
| Conversion functions | Per-runtime functions | Consider converter registry pattern |
| Test coverage | Manual testing per runtime | Need automated per-runtime test matrix |
| File size | 2376 lines, still readable | Consider splitting into install-copilot.js module |

**Near-term recommendation:** Keep everything in `install.js` for v1.23. The existing pattern of runtime-specific branches is consistent and the Copilot additions (~200-300 lines of new code) won't push it past maintainability limits.

**Future consideration:** If a 6th runtime is added, refactor to a runtime config object pattern:
```javascript
const RUNTIMES = {
  copilot: {
    dirName: '.github',
    globalSupport: false,
    convertCommand: convertClaudeCommandToCopilotSkill,
    convertAgent: convertClaudeAgentToCopilotAgent,
    hasHooks: false,
    ...
  }
};
```

## Suggested Build Order

Implementation should proceed in this order, each step testable independently:

### Step 1: CLI Plumbing (low risk, enables everything)
- Add `--copilot` flag
- Add `copilot` to `--all`
- Update `getDirName()`, `getGlobalDir()`, `getConfigDirFromHome()`
- Add local-only guard for `--copilot --global`
- Update `promptRuntime()` menu
- Update banner and help text

### Step 2: Command → Skill Conversion (core feature)
- Write `convertClaudeCommandToCopilotSkill()` function
- Write `copyCommandsAsCopilotSkills()` function  
- Test: verify output matches existing `.github/skills/gsd-*/SKILL.md` files

### Step 3: Agent Conversion (core feature)
- Write `convertClaudeAgentToCopilotAgent()` function
- Add `.agent.md` suffix rename logic in agent copy loop
- Implement Copilot tool name mapping
- Test: verify output matches existing `.github/agents/gsd-*.agent.md` files

### Step 4: Core Engine Copy + Generated Files
- Add copilot path replacement in `copyWithPathReplacement()`
- Write `generateCopilotRouterSkill()` (static content)
- Write `generateCopilotInstructions()` (static content)
- Wire into `install()` function

### Step 5: Uninstall + Manifest
- Add copilot branch to `uninstall()` with safe `.github/` handling
- Add copilot branch to `writeManifest()`
- Add copilot branch to `reportLocalPatches()`
- Add copilot label to `finishInstall()`

### Step 6: Integration Testing
- Run full install to `/tmp/test-project/.github/`
- Diff output against existing reference implementation in `.github/`
- Verify uninstall removes only GSD files
- Test install + uninstall + reinstall cycle

## Critical Observation: Reference Implementation as Test Oracle

The existing `.github/` directory in this repository IS the reference Copilot implementation. The install manifest at `.github/get-shit-done/.gsd-install-manifest.json` documents every file that should be produced. This means:

1. **Every expected output file is already available** for comparison
2. **The conversion logic can be validated** by diffing installer output against the reference
3. **The test strategy is straightforward**: install to `/tmp/`, diff against `.github/`, verify exact match

This is a significant advantage — unlike other runtimes that were built from scratch, Copilot has a known-good reference.

## Sources

- `bin/install.js` — Direct analysis (2376 lines, full read)
- `.github/skills/` — 32 Copilot skill directories examined
- `.github/agents/` — 11 Copilot agent files examined
- `.github/get-shit-done/` — Core engine directory examined
- `.github/copilot-instructions.md` — Copilot instructions file examined
- `.github/get-shit-done/.gsd-install-manifest.json` — Full file manifest (platform: copilot, scope: local)
- `commands/gsd/` — 32 Claude source command files (for conversion comparison)
- `agents/` — 11 Claude source agent files (for conversion comparison)
- `diff` analysis between Claude source and Copilot reference output for multiple files
