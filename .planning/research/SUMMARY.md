# Project Research Summary

**Project:** GitHub Copilot CLI Runtime Support
**Domain:** Multi-runtime AI coding assistant installer — adding Copilot CLI as 5th runtime
**Researched:** 2025-03-02
**Confidence:** HIGH

## Executive Summary

This project adds GitHub Copilot CLI as the 5th supported runtime to the GSD multi-runtime installer (`bin/install.js`). The existing installer already handles Claude Code, OpenCode, Gemini, and Codex through a well-established pattern of source-to-target conversion. Copilot follows the Codex pattern most closely — both use `skills/gsd-*/SKILL.md` directory structure, both skip hooks and `settings.json` — but Copilot is simpler (no adapter headers, no TOML config files) and architecturally unique in being **local-only** (files go to `.github/` in the repository, not a home directory). Zero new dependencies are needed; this is purely additive installer logic adding ~200-300 lines to `install.js`.

The recommended approach is to build Copilot support in three phases: (1) core installer plumbing (CLI flags, directory resolution, local-only enforcement, hooks bypass), (2) content conversion engine (skill/agent conversion functions, tool name mapping, path replacement, generated files like `copilot-instructions.md` and the router skill), and (3) lifecycle completion (uninstall, manifest, local patches, verification). A critical advantage is that a **complete reference implementation already exists** in the repository's `.github/` directory — every expected output file is available for diff-based validation, making this a unusually testable feature.

The key risks are: (1) the `.github/` target directory breaks the global/local install model that all 4 existing runtimes follow — Copilot must be gated as local-only with graceful handling in `--all --global` scenarios, (2) subtle format differences from Codex (no adapter headers, different tool names, `.agent.md` suffix) mean the Codex converter **cannot be reused** — dedicated Copilot conversion functions are required, and (3) `copilot-instructions.md` is a shared file that must use marker-based merging to avoid destroying user content. All three risks have clear mitigation strategies documented in the research.

## Key Findings

### Recommended Stack

No new dependencies. The existing Node.js (>=16.7.0) stack with built-in `fs`, `path`, `os`, `readline`, and `crypto` modules handles everything Copilot needs. The zero-dependency constraint is preserved. See [STACK.md](STACK.md) for full details.

**Core technologies (unchanged):**
- **Node.js CommonJS (>=16.7.0):** Installer runtime — no new APIs needed
- **Built-in `fs`/`path`/`os`:** File copy and transformation — same pattern as existing runtimes
- **Built-in `readline`:** Interactive prompts — add Copilot as option 5

**What's new (code, not dependencies):**
- 5 new conversion functions: `convertClaudeCommandToCopilotSkill()`, `convertClaudeAgentToCopilotAgent()`, `convertCopilotToolName()`, `copyCommandsAsCopilotSkills()`, `generateCopilotInstructions()`
- 3 new generated files: `copilot-instructions.md`, router skill (`get-shit-done/SKILL.md`), and `.agent.md` agent files
- 12 existing functions need minor changes (add `copilot` branches)

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature landscape with dependency graph and prioritization matrix.

**Must have (table stakes — 18 features, all P1/P2):**
- `--copilot` CLI flag + interactive prompt + `--all` inclusion (TS-1/2/3)
- Skills generation: convert `commands/gsd/*.md` → `.github/skills/gsd-*/SKILL.md` (TS-4)
- Agent conversion with `.agent.md` rename and tool name mapping (TS-5/6)
- Path replacement `~/.claude/` → `.github/` throughout all content (TS-7)
- Core engine copy to `.github/get-shit-done/` (TS-8)
- Router skill generation — Copilot's command discovery mechanism (TS-9)
- `copilot-instructions.md` with marker-based merging (TS-10)
- Local-only enforcement — error on `--copilot --global` (TS-12)
- Uninstall support preserving non-GSD `.github/` content (TS-14)
- Manifest and local patch persistence (TS-15/16)

**Should have (differentiators — ship with MVP):**
- Smart `copilot-instructions.md` merging with HTML comment markers (DF-1) — coupled with TS-10, must ship together
- Copilot-specific skill adapter header for runtime tool translation (DF-2)
- Post-install verification (DF-4)

**Defer (v2+):**
- Auto-detect `.github/` conflicts (DF-3) — only if users report issues
- All anti-features (AF-1 through AF-6): no global install, no hooks, no config.toml, no body text tool conversion, no custom prefixes

### Architecture Approach

Copilot integrates into the existing `install()` function as a new runtime branch, following the Codex pattern most closely but with dedicated conversion functions. The architecture is additive: 12 existing functions get Copilot branches, 5-8 new functions handle Copilot-specific conversion. The `.github/` directory requires special handling — it's shared with GitHub Actions/workflows/CODEOWNERS, so the installer must ONLY touch GSD-managed subdirectories (`skills/gsd-*`, `agents/gsd-*.agent.md`, `get-shit-done/`, `copilot-instructions.md`). See [ARCHITECTURE.md](ARCHITECTURE.md) for full component diagram and data flow.

**Major components:**
1. **CLI plumbing** — `--copilot` flag, `getDirName()`, `getGlobalDir()` guard, `promptRuntime()` update
2. **Content conversion** — `convertClaudeCommandToCopilotSkill()`, `convertClaudeAgentToCopilotAgent()`, tool name mapping, path replacement
3. **Generated artifacts** — `copilot-instructions.md`, router skill (`get-shit-done/SKILL.md`), `.agent.md` agent files
4. **Lifecycle management** — Uninstall with safe `.github/` cleanup, manifest tracking, local patch detection

**Key patterns to follow:**
- Parallel to Codex for skill directory structure
- Safe `.github/` directory management (never wipe, only manage GSD-prefixed items)
- Local-only runtime guard (first runtime without global support)
- Marker-based `copilot-instructions.md` merging (like Codex's `config.toml` marker pattern)

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 10 pitfalls with detailed prevention strategies and phase mapping.

1. **`.github/` breaks global/local model** — Copilot is local-only; `getDirName('copilot')` must return `.github`, `getGlobalDir('copilot')` must error. Gate `--copilot --global` early. Handle `--all --global` by installing Copilot locally while others go global.
2. **Agent `.agent.md` naming convention** — Copilot requires `.agent.md` suffix, not `.md`. Must rename during copy AND update uninstall/manifest to match the new pattern. Missing this means Copilot silently ignores all agents.
3. **Codex skill converter produces wrong output** — Despite similar directory structure, Copilot skills must NOT have `<codex_skill_adapter>` headers or `{{GSD_ARGS}}` placeholders. Write a dedicated converter.
4. **`copilot-instructions.md` clobbering** — This is a shared file. Use `<!-- GSD Instructions -->` marker comments for section-based merging. Never overwrite the entire file.
5. **`--all` flag regression** — Adding Copilot to `--all` breaks `--all --global` for existing users. Filter runtimes by `supportsGlobal()` capability, or install Copilot locally while others go global.

## Implications for Roadmap

Based on combined research, the project naturally decomposes into 4 phases ordered by dependency chain and risk:

### Phase 1: Core Installer Plumbing
**Rationale:** Everything else depends on correct CLI flag parsing, directory resolution, and install flow control. This is foundational and low-risk.
**Delivers:** A Copilot runtime that can be selected but doesn't produce output yet — the skeleton that all conversion logic plugs into.
**Addresses:** TS-1, TS-2, TS-3, TS-12, TS-13, TS-17 (CLI flags, prompt, `--all`, local-only guard, `getDirName`, banner/help)
**Avoids:** Pitfall 1 (global/local model breakage), Pitfall 5 (`--all` regression), Pitfall 8 (hooks/settings leaking), Pitfall 10 (manifest location)
**Estimated scope:** ~80-100 lines of changes across existing functions

### Phase 2: Content Conversion Engine
**Rationale:** This is the core feature — converting source commands/agents to Copilot format. Depends on Phase 1 for directory resolution and path prefix. Has the reference implementation as test oracle.
**Delivers:** Working Copilot installation that produces correct skills, agents, and generated files.
**Addresses:** TS-4, TS-5, TS-6, TS-7, TS-8, TS-9, TS-10, TS-11, DF-1, DF-2 (skills, agents, tool mapping, paths, core files, router, instructions, command names, smart merging, adapter header)
**Avoids:** Pitfall 2 (agent naming), Pitfall 3 (Codex format reuse), Pitfall 4 (instructions clobbering), Pitfall 6 (path regex), Pitfall 7 (missing router skill)
**Estimated scope:** ~150-200 lines of new conversion functions

### Phase 3: Lifecycle Completion
**Rationale:** Uninstall, manifest, and local patches depend on install producing correct output (Phase 2). These are parity features — the infrastructure already exists for other runtimes.
**Delivers:** Complete install/uninstall/reinstall cycle with patch persistence.
**Addresses:** TS-14, TS-15, TS-16, TS-18, DF-4 (uninstall, manifest, patches, changelog/version, verification)
**Avoids:** Pitfall 9 (incomplete uninstall), Pitfall 10 (manifest in wrong location)
**Estimated scope:** ~50-80 lines of changes to existing lifecycle functions

### Phase 4: Integration Testing & Validation
**Rationale:** The reference implementation in `.github/` is the test oracle. Full-cycle testing validates all phases work together.
**Delivers:** Confidence that installer output matches reference implementation exactly.
**Addresses:** All features — validates end-to-end correctness
**Avoids:** All pitfalls — the "Looks Done But Isn't" checklist (12 items from PITFALLS.md) serves as the acceptance criteria
**Estimated scope:** Test scripts, diff-based validation, regression tests for `--all`

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Directory resolution (`getDirName`, `getGlobalDir`, path prefix) must be correct before any content conversion runs. The `--all` regression must be handled before any release.
- **Phase 2 before Phase 3:** Uninstall and manifest must know what files were installed. The conversion functions define the file set.
- **Phase 4 last:** Integration testing validates the complete chain. The reference implementation diff strategy only works when all phases are complete.
- **Grouping logic:** Phase 1 is "plumbing" (existing function modifications), Phase 2 is "new code" (conversion functions), Phase 3 is "lifecycle" (existing infrastructure extensions). This separation matches the architecture's component boundaries.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** The tool name mapping and path replacement regex need validation against the full set of 32 skills and 11 agents. Edge cases in frontmatter parsing (multi-line `allowed-tools`, conditional tool inclusion) should be investigated during phase planning. The `copilot-instructions.md` merge logic has no existing precedent in the installer — it's new string manipulation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Follows established patterns from Codex integration. All changes are additive branches in existing switch/if blocks. Well-documented in ARCHITECTURE.md with line numbers.
- **Phase 3:** Reuses existing `uninstall()`, `writeManifest()`, `saveLocalPatches()` infrastructure with minor Copilot branches. The pattern is identical to what was done for Codex.
- **Phase 4:** Test strategy is already defined — diff installer output against reference implementation in `.github/`. The manifest file lists every expected output.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Zero new dependencies. All technology decisions are "keep what exists." Source: direct code analysis. |
| Features | **HIGH** | Feature list derived from direct comparison of 4 existing runtimes + working Copilot reference implementation. Every feature has a concrete precedent. |
| Architecture | **HIGH** | Architecture derived from direct analysis of `install.js` (2376 lines) with specific line numbers. Build order tested against dependency graph. Reference implementation validates all file mappings. |
| Pitfalls | **HIGH** | All 10 pitfalls identified from concrete code analysis — not theoretical. Each pitfall cites specific lines in `install.js` and has a prevention strategy. The "Looks Done But Isn't" checklist is derived from observed format differences. |

**Overall confidence: HIGH**

All research is based on **primary sources**: the existing installer source code, the working Copilot reference implementation in `.github/`, and direct diff analysis between Claude source files and Copilot output files. No external documentation or community sources were needed — the codebase is self-documenting.

### Gaps to Address

- **`copilot-instructions.md` merge logic:** No existing precedent in the installer for marker-based markdown merging. The `config.toml` marker pattern (Codex) is the closest analog, but markdown merging has different edge cases. Needs careful implementation and testing with various pre-existing instruction file formats.
- **Tool name mapping completeness:** The mapping is derived from existing `.agent.md` files, but newer Copilot CLI versions may add/change tools. The mapping should be defined as a constant object for easy updates.
- **`--all --global` mixed mode:** The exact UX for installing 4 runtimes globally + Copilot locally in a single invocation needs design during Phase 1 planning. Options: (a) silently install Copilot locally with a note, (b) prompt user, (c) skip Copilot with warning.
- **Monorepo support:** `.github/` is always at repo root. Monorepos with multiple projects sharing one `.github/` are not addressed. Acceptable to defer — not a launch blocker.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` — 2376-line installer with 4 existing runtime patterns (full read, line-level analysis)
- `.github/skills/gsd-*/SKILL.md` — 32 reference Copilot skill files (format, frontmatter, content)
- `.github/agents/gsd-*.agent.md` — 11 reference Copilot agent files (tool mapping, naming convention)
- `.github/copilot-instructions.md` — Copilot system prompt format and GSD routing instructions
- `.github/get-shit-done/.gsd-install-manifest.json` — Complete file manifest with `platform: "copilot"`, `scope: "local"`
- `commands/gsd/*.md` — 32 Claude source command files (conversion input)
- `agents/gsd-*.md` — 11 Claude source agent files (conversion input)
- `.gitignore` — Confirms GSD artifacts in `.github/` are generated files

### Secondary (MEDIUM confidence)
- Codex integration patterns (`convertClaudeCommandToCodexSkill()`, etc.) — used as architectural template, not directly applicable to Copilot format

---
*Research completed: 2025-03-02*
*Ready for roadmap: yes*
