# Phase 1: Core Installer Plumbing - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Copilot as a 5th supported runtime in the installer's CLI layer: argument parsing, directory resolution, interactive prompt, and help text. This phase delivers the foundation that content conversion (Phase 2) builds on.

</domain>

<decisions>
## Implementation Decisions

### Global & Local Install Model

- **Copilot supports BOTH global and local installation** (research was wrong about local-only)
- Local installs go to `.github/` in the project directory
- Global installs go to `~/.copilot/` in the home directory
- `getDirName('copilot')` returns `.github` for local mode
- `getGlobalDir('copilot')` returns `~/.copilot/` for global mode
- This follows the OpenCode pattern which already has different local vs global paths
- Confirmed by user testing: `~/.copilot/skills/`, `~/.copilot/agents/`, and `~/.copilot/copilot-instructions.md` all work globally

### Default Behavior

- Same as other runtimes: when user runs `--copilot` without `--global` or `--local`, prompt them to choose
- No special-casing for Copilot — consistent UX across all runtimes

### Interactive Prompt Placement

- Copilot appears as option 5 (after Codex, before "All")
- Current order: 1) Claude Code, 2) OpenCode, 3) Gemini CLI, 4) Codex, 5) **Copilot CLI**, 6) All
- "All" renumbered from 5 to 6

### --all Flag Behavior

- `--all` includes Copilot alongside existing 4 runtimes (5 total)
- `--all --global` installs all runtimes globally — Copilot goes to `~/.copilot/`, others to their respective global dirs
- `--all --local` installs all locally — Copilot goes to `.github/`, others to their respective local dirs

### Hooks

- **Deferred to future milestone** — Copilot CLI does support hooks (preToolUse, postToolUse, sessionStart, sessionEnd) but we won't implement them in this milestone
- Skip hook registration for Copilot runtime (same pattern as Codex currently)

### Custom Instructions

- Generate `copilot-instructions.md` in both modes:
  - Local: `.github/copilot-instructions.md`
  - Global: `~/.copilot/copilot-instructions.md`
- Do NOT generate AGENTS.md (Copilot reads it but it's a different standard)

### Claude's Discretion

- Exact error/warning messages for edge cases
- Banner formatting details
- Help text wording

</decisions>

<specifics>
## Specific Ideas

- The existing OpenCode implementation in `install.js` is the closest pattern for handling different local vs global paths — use it as reference
- The `--both` legacy flag currently maps to ['claude', 'opencode'] — do NOT modify this
- Testing should happen in `/tmp` directory, not the project directory

</specifics>

<deferred>
## Deferred Ideas

- **Copilot hooks support** — Copilot CLI supports hooks but deferred to future milestone
- **AGENTS.md generation** — Copilot reads AGENTS.md from repo root, could be useful but not in this milestone
- **Path-specific instructions** — Copilot supports `.github/instructions/*.instructions.md`, could be useful for GSD context injection later

</deferred>

## Key Documentation References

- Skills: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- Custom agents: https://docs.github.com/en/copilot/reference/custom-agents-configuration
- Custom instructions: https://docs.github.com/en/copilot/how-tos/copilot-cli/add-custom-instructions
- Tool aliases: https://docs.github.com/en/copilot/reference/custom-agents-configuration#tool-aliases

---

*Phase: 01-core-installer-plumbing*
*Context gathered: 2026-03-02*
