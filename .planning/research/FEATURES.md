# Feature Research: Copilot CLI Runtime Installation

**Domain:** Multi-runtime AI coding assistant installer — GitHub Copilot CLI support
**Researched:** 2025-03-02
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features required for a working Copilot CLI installation. Missing any of these = Copilot runtime is broken.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| TS-1 | `--copilot` CLI flag | Parity with `--claude`, `--opencode`, `--gemini`, `--codex` flags | LOW | Add to arg parsing, `selectedRuntimes` logic |
| TS-2 | Copilot in interactive runtime prompt | Users choosing runtimes interactively expect to see Copilot as option 5 | LOW | Update `promptRuntime()`, renumber "All" to 6 |
| TS-3 | Copilot in `--all` flag | `--all` must include copilot alongside the existing 4 runtimes | LOW | Add `'copilot'` to the `--all` array |
| TS-4 | Skills generation from commands | Convert `commands/gsd/*.md` → `.github/skills/gsd-*/SKILL.md` | MEDIUM | Same directory-per-skill pattern as Codex. Each command becomes a `SKILL.md` inside its own subdirectory. Must convert command names (`gsd:name` → `gsd-name`), paths (`~/.claude/` → `.github/`), and tool names |
| TS-5 | Agent file copying with extension rename | Copy `agents/gsd-*.md` → `.github/agents/gsd-*.agent.md` | MEDIUM | Copilot CLI uses `.agent.md` extension (not plain `.md`). Must convert tool names in frontmatter and replace path references |
| TS-6 | Tool name mapping (Claude → Copilot) | Copilot CLI uses different tool names than Claude Code | MEDIUM | Observed mapping: `Read→read`, `Write→edit`, `Edit→edit`, `Bash→execute`, `Grep→search`, `Glob→search`, `WebSearch→websearch`, `WebFetch→webfetch`. MCP tools (`mcp__*`) kept as-is |
| TS-7 | Path replacement to `.github/` | All `~/.claude/` and `./.claude/` refs must become `.github/` | LOW | Copilot reads from repo-level `.github/` directory. No home-directory config equivalent |
| TS-8 | Core files to `.github/get-shit-done/` | The `get-shit-done/` directory (bin, references, templates, workflows) must be installed | LOW | Same `copyWithPathReplacement()` pattern as other runtimes, targeting `.github/get-shit-done/` |
| TS-9 | Router skill generation | Generate `.github/skills/get-shit-done/SKILL.md` — the meta-skill that teaches Copilot how to route `/gsd-*` commands | MEDIUM | This file already exists in the repo as reference. It maps `/gsd-*` inputs to the correct skill file and documents tool mappings. Must be generated during install |
| TS-10 | `copilot-instructions.md` generation | Generate/update `.github/copilot-instructions.md` with GSD instructions | MEDIUM | This is the Copilot equivalent of `settings.json`. Must merge with existing content (not overwrite). See Anti-Feature AF-3 |
| TS-11 | Command name conversion | `gsd:name` → `gsd-name` in all content | LOW | Same pattern as OpenCode/Codex. Replace `/gsd:` with `/gsd-` throughout |
| TS-12 | Local-only installation | Copilot always installs to `.github/` in the project root | LOW | No global install concept — Copilot reads from repo `.github/`. Must error/warn if `--global` combined with `--copilot` |
| TS-13 | `getDirName('copilot')` returns `.github` | Installer's directory resolution must map copilot → `.github` | LOW | Used throughout for path construction |
| TS-14 | Uninstall support | `--copilot --local --uninstall` removes GSD skills, agents, get-shit-done dir from `.github/` | MEDIUM | Must remove `skills/gsd-*`, `agents/gsd-*.agent.md`, `get-shit-done/`, clean `copilot-instructions.md`. Must NOT remove non-GSD `.github/` content |
| TS-15 | File manifest for change detection | Write `gsd-file-manifest.json` after installation | LOW | Enables the local patch persistence system (same as other runtimes) |
| TS-16 | Local patch persistence | Detect user modifications before reinstall, back up to `gsd-local-patches/` | LOW | Existing `saveLocalPatches()`/`reportLocalPatches()` infrastructure. Reapply command: `/gsd-reapply-patches` |
| TS-17 | Banner and help text updates | Update the banner, help text, and example commands to include Copilot | LOW | Update `banner`, `--help` output, examples section |
| TS-18 | `CHANGELOG.md` and `VERSION` file | Copy changelog and write version marker to `.github/get-shit-done/` | LOW | Same as other runtimes |

### Differentiators (Competitive Advantage)

Features that improve the Copilot installation experience beyond the minimum.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| DF-1 | Smart `copilot-instructions.md` merging | Append GSD instructions to existing file instead of overwriting, with a GSD marker section for clean updates | MEDIUM | Users may already have `copilot-instructions.md` with their own instructions. Use a marker pattern (like Codex's `GSD_CODEX_MARKER`) to identify GSD section: `<!-- GSD Configuration -->`. On reinstall, replace only the GSD section |
| DF-2 | Copilot-specific skill adapter header | Add a `<copilot_skill_adapter>` header to skills explaining Copilot-specific tool translations | LOW | Similar to Codex's `<codex_skill_adapter>` header. Maps `AskUserQuestion` → ask in chat with options, `Task/subagent` → prefer matching agent from `.github/agents`, `Bash` → execute tool |
| DF-3 | Auto-detect `.github/` conflicts | Warn if `.github/skills/` or `.github/agents/` already contain non-GSD files that might conflict | LOW | Prevents user confusion. Just a warning, not a blocker |
| DF-4 | Verification after install | Verify `.github/skills/gsd-*/SKILL.md` files exist and `.github/agents/gsd-*.agent.md` files exist | LOW | Reuse existing `verifyInstalled()` and `verifyFileInstalled()` patterns |

### Anti-Features (Deliberately NOT Building)

| # | Feature | Why It Seems Appealing | Why Problematic | What to Do Instead |
|---|---------|------------------------|-----------------|-------------------|
| AF-1 | Global installation for Copilot | Consistency with other runtimes that support `--global` | Copilot CLI reads skills/agents from the repo's `.github/` directory only. There is no `~/.copilot/` global config. Global install would put files where Copilot can't find them | Support `--local` only. Print clear error message if `--copilot --global` is specified |
| AF-2 | Hook system for Copilot | Other runtimes (Claude, Gemini) have hooks for statusline, update checks, context monitoring | Copilot CLI has no hook/lifecycle event system. No `settings.json` equivalent, no `SessionStart`/`PostToolUse` events | Skip hooks, statusline, settings.json, and `package.json` CommonJS marker entirely for Copilot. Same pattern as Codex |
| AF-3 | Overwriting `copilot-instructions.md` | Simpler implementation: just write the file | Users may have custom instructions they've carefully crafted. Overwriting destroys their work | Use marker-based merging (DF-1). If no markers found, append to end of file with clear section header |
| AF-4 | Converting Copilot tool names in agent body content | Tool references in body text (e.g., "use the Bash tool") could be auto-converted | Body text tool mentions are part of the prompt engineering. Auto-replacing in prose risks breaking instructions that reference tools by their canonical names for cross-platform understanding | Only convert tool names in frontmatter `tools:` field. Leave body text as-is. The router skill's tool mapping section handles the translation at runtime |
| AF-5 | `config.toml` or similar config for Copilot | Codex has `config.toml` for agent configuration | Copilot CLI discovers agents from `.agent.md` files directly. No config file needed | Let Copilot's native agent discovery handle it |
| AF-6 | Custom command prefix for Copilot | Supporting something other than `/gsd-*` for Copilot | The router skill already teaches Copilot to interpret `/gsd-*` as skill invocations. Adding alternate prefixes creates confusion | Standardize on `/gsd-*` prefix across all runtimes (OpenCode/Codex already use this) |

## Feature Dependencies

```
TS-1 (--copilot flag)
    └── enables ──> TS-2 (interactive prompt)
    └── enables ──> TS-3 (--all inclusion)
    └── enables ──> TS-12 (local-only enforcement)

TS-13 (getDirName → .github)
    └── required by ──> TS-4 (skills generation)
    └── required by ──> TS-5 (agent copying)
    └── required by ──> TS-7 (path replacement)
    └── required by ──> TS-8 (core files)
    └── required by ──> TS-14 (uninstall)

TS-6 (tool name mapping)
    └── required by ──> TS-4 (skills generation, frontmatter conversion)
    └── required by ──> TS-5 (agent frontmatter conversion)

TS-4 (skills generation)
    └── enhances with ──> TS-9 (router skill)
    └── enhances with ──> DF-2 (skill adapter header)

TS-8 (core files) + TS-4 (skills) + TS-5 (agents)
    └── required by ──> TS-15 (manifest generation)
    └── required by ──> TS-16 (local patch persistence)

TS-10 (copilot-instructions.md)
    └── enhanced by ──> DF-1 (smart merging)

TS-14 (uninstall)
    └── requires ──> TS-10 (must know how to clean copilot-instructions.md)
```

### Dependency Notes

- **TS-13 is the foundation:** `getDirName('copilot')` returning `.github` unlocks all path-related features. Must be implemented first.
- **TS-6 (tool mapping) is the conversion core:** Both skills and agents need tool name conversion. Define the mapping function once, reuse everywhere.
- **TS-4 closely parallels Codex:** The `copyCommandsAsCodexSkills()` function is nearly what's needed. Copilot uses the same `skills/gsd-*/SKILL.md` directory structure.
- **TS-10 and DF-1 are coupled:** The basic `copilot-instructions.md` generation (TS-10) should use the smart merging approach (DF-1) from day one to avoid breaking user configs.
- **TS-14 (uninstall) requires TS-10:** Uninstall must know how to clean GSD sections from `copilot-instructions.md` without destroying user content.

## Copilot-Specific Tool Name Mapping

Based on analysis of existing `.github/agents/gsd-*.agent.md` files:

| Claude Tool | Copilot Tool | Notes |
|-------------|-------------|-------|
| `Read` | `read` | Direct mapping |
| `Write` | `edit` | Copilot uses `edit` for both write and edit |
| `Edit` | `edit` | Same as Write |
| `Bash` | `execute` | Shell execution |
| `Grep` | `search` | File content search |
| `Glob` | `search` | File path search (combined with Grep) |
| `WebSearch` | `websearch` | Web search capability |
| `WebFetch` | `webfetch` | URL fetching |
| `Task` | (excluded) | Agents are referenced directly, not via Task tool |
| `AskUserQuestion` | (excluded) | Ask directly in chat — no dedicated tool |
| `SlashCommand` | (excluded) | Skills are loaded directly |
| `TodoWrite` | (excluded) | No Copilot equivalent |
| `mcp__*` | `mcp__*` | Keep as-is (MCP protocol) |

## Copilot vs Other Runtimes — Structural Comparison

| Aspect | Claude | OpenCode | Gemini | Codex | **Copilot** |
|--------|--------|----------|--------|-------|-------------|
| Config root (global) | `~/.claude/` | `~/.config/opencode/` | `~/.gemini/` | `~/.codex/` | **N/A (local only)** |
| Config root (local) | `.claude/` | `.opencode/` | `.gemini/` | `.codex/` | **`.github/`** |
| Commands location | `commands/gsd/*.md` | `command/gsd-*.md` | `commands/gsd/*.toml` | `skills/gsd-*/SKILL.md` | **`skills/gsd-*/SKILL.md`** |
| Command format | Nested dir, `.md` | Flat, `.md` | Nested dir, `.toml` | Dir per skill, `SKILL.md` | **Dir per skill, `SKILL.md`** |
| Agent location | `agents/gsd-*.md` | `agents/gsd-*.md` | `agents/gsd-*.md` | `agents/gsd-*.md` | **`agents/gsd-*.agent.md`** |
| Agent config | None | None | None | `agents/gsd-*.toml` + `config.toml` | **None** |
| Settings | `settings.json` | `opencode.json` | `settings.json` | `config.toml` | **`copilot-instructions.md`** |
| Hooks | Yes (3 hooks) | No | Yes (3 hooks) | No | **No** |
| Statusline | Yes | No | Yes | No | **No** |
| Global install | Yes (default) | Yes (default) | Yes (default) | Yes (default) | **No** |
| Local install | Yes | Yes | Yes | Yes | **Yes (only option)** |
| Router needed | No (native `/gsd:*`) | No (native `/gsd-*`) | No (native `/gsd:*`) | No (`$gsd-*`) | **Yes (`get-shit-done` skill)** |
| CommonJS marker | Yes | Yes | Yes | No | **No** |

## MVP Definition

### Launch With (v1.23)

Minimum viable Copilot installation — what's needed for GSD to work in Copilot CLI.

- [ ] TS-1 — `--copilot` flag in arg parsing
- [ ] TS-2 — Copilot in interactive runtime prompt
- [ ] TS-3 — Copilot in `--all` array
- [ ] TS-4 — Skills generation from commands
- [ ] TS-5 — Agent file copying with `.agent.md` rename
- [ ] TS-6 — Tool name mapping (Claude → Copilot)
- [ ] TS-7 — Path replacement to `.github/`
- [ ] TS-8 — Core files to `.github/get-shit-done/`
- [ ] TS-9 — Router skill generation
- [ ] TS-10 + DF-1 — `copilot-instructions.md` with smart merging
- [ ] TS-11 — Command name conversion (`gsd:` → `gsd-`)
- [ ] TS-12 — Local-only enforcement (error on `--global --copilot`)
- [ ] TS-13 — `getDirName('copilot')` → `.github`
- [ ] TS-14 — Uninstall support
- [ ] TS-15 — File manifest
- [ ] TS-16 — Local patch persistence
- [ ] TS-17 — Banner and help text updates
- [ ] TS-18 — CHANGELOG.md and VERSION
- [ ] DF-2 — Copilot skill adapter header
- [ ] DF-4 — Post-install verification

### Add After Validation (v1.x)

- [ ] DF-3 — Auto-detect `.github/` conflicts (only if users report issues)

### Not Building

- AF-1 through AF-6 — Explicitly excluded (see Anti-Features table)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| TS-13 (getDirName) | HIGH | LOW | **P1** | Foundation — everything else depends on it |
| TS-1/2/3 (CLI flags) | HIGH | LOW | **P1** | Entry point — users can't install without it |
| TS-6 (tool mapping) | HIGH | MEDIUM | **P1** | Core conversion — skills and agents break without it |
| TS-4 (skills) | HIGH | MEDIUM | **P1** | Primary deliverable — commands as skills |
| TS-5 (agents) | HIGH | MEDIUM | **P1** | Primary deliverable — agents with .agent.md |
| TS-7/8/11 (paths, core, names) | HIGH | LOW | **P1** | Required plumbing for working installation |
| TS-9 (router skill) | HIGH | LOW | **P1** | Without this, Copilot can't discover GSD commands |
| TS-10 + DF-1 (instructions) | HIGH | MEDIUM | **P1** | First-run experience — Copilot needs to know about GSD |
| TS-12 (local-only) | MEDIUM | LOW | **P1** | Prevents confusing errors |
| TS-14 (uninstall) | MEDIUM | MEDIUM | **P1** | Parity with other runtimes |
| TS-15/16 (manifest, patches) | MEDIUM | LOW | **P2** | Important but existing infra handles most of it |
| TS-17/18 (banner, changelog) | LOW | LOW | **P2** | Polish |
| DF-2 (adapter header) | MEDIUM | LOW | **P2** | Improves command translation quality |
| DF-4 (verification) | LOW | LOW | **P2** | Nice insurance |
| DF-3 (conflict detection) | LOW | LOW | **P3** | Only if users hit issues |

**Priority key:**
- P1: Must have for launch — installation doesn't work without it
- P2: Should have — improves quality, low effort
- P3: Nice to have — defer unless trivial

## Implementation Notes

### Closest Existing Pattern: Codex

The Copilot installation is structurally closest to Codex:
- Both use `skills/gsd-*/SKILL.md` directory structure for commands
- Both skip hooks, statusline, and `package.json`
- Both need special frontmatter/content conversion

Key differences from Codex:
1. **Agent extension:** Copilot uses `.agent.md`, Codex uses plain `.md` + `.toml` config
2. **No config.toml:** Copilot discovers agents from `.agent.md` files directly
3. **Router skill:** Copilot needs the `get-shit-done` meta-skill; Codex uses `$` prefix natively
4. **`copilot-instructions.md`:** Replaces Codex's `config.toml` as the "settings" mechanism
5. **Local only:** Codex supports global; Copilot is project-level only
6. **Tool mapping:** Different mapping than Codex (Codex is closer to Claude tool names)

### Reusable Functions

These existing functions can be reused or adapted for Copilot:
- `copyCommandsAsCodexSkills()` → Adapt for Copilot skill format (different conversion, same directory structure)
- `copyWithPathReplacement()` → Reuse for core files (add `copilot` runtime branch)
- `extractFrontmatterAndBody()` → Reuse as-is
- `extractFrontmatterField()` → Reuse as-is
- `saveLocalPatches()` / `reportLocalPatches()` → Reuse as-is
- `writeManifest()` → Extend to handle `.github/skills/` and `.github/agents/` paths
- `verifyInstalled()` / `verifyFileInstalled()` → Reuse as-is

### New Functions Needed

1. **`convertClaudeToCopilotToolName(claudeTool)`** — Maps Claude tool names to Copilot equivalents
2. **`convertClaudeCommandToCopilotSkill(content, skillName)`** — Converts command to Copilot SKILL.md format
3. **`convertClaudeToCopilotAgent(content)`** — Converts agent frontmatter for Copilot (tool names, preserves body)
4. **`generateCopilotInstructions()`** — Creates the GSD section for `copilot-instructions.md`
5. **`mergeCopilotInstructions(existingContent, gsdSection)`** — Merges GSD instructions into existing file
6. **`stripGsdFromCopilotInstructions(content)`** — Removes GSD section for uninstall
7. **`generateCopilotRouterSkill()`** — Creates the `get-shit-done/SKILL.md` meta-skill
8. **`copyCommandsAsCopilotSkills(srcDir, skillsDir, prefix, pathPrefix)`** — Variant of Codex skill copy

## Sources

- **HIGH confidence:** Direct analysis of existing `.github/skills/`, `.github/agents/`, and `.github/copilot-instructions.md` in the GSD repository (these are the reference implementation)
- **HIGH confidence:** Direct analysis of `bin/install.js` — the existing multi-runtime installer (2,376 lines)
- **HIGH confidence:** Comparison of source `commands/gsd/*.md` vs `.github/skills/gsd-*/SKILL.md` — concrete diff showing exact conversion needed
- **HIGH confidence:** Comparison of source `agents/gsd-*.md` vs `.github/agents/gsd-*.agent.md` — concrete diff showing tool name mapping and extension change

---
*Feature research for: GitHub Copilot CLI runtime installation support*
*Researched: 2025-03-02*
