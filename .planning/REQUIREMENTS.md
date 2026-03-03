# Requirements: GSD Copilot CLI Support

**Defined:** 2026-03-02
**Core Value:** Add GitHub Copilot CLI as a fully supported 5th runtime in the GSD installer

## v1.23 Requirements

Requirements for Copilot CLI installation support. Each maps to roadmap phases.

### CLI Integration

- [x] **CLI-01**: Installer accepts `--copilot` flag to select Copilot runtime
- [x] **CLI-02**: Interactive runtime prompt includes Copilot as option (renumber "All")
- [x] **CLI-03**: `--all` flag includes Copilot alongside existing 4 runtimes
- [x] **CLI-04**: `--copilot --global` is rejected with clear error (Copilot is local-only)
- [x] **CLI-05**: `getDirName('copilot')` returns `.github`
- [x] **CLI-06**: Banner, help text, and examples updated to include Copilot

### Content Conversion

- [x] **CONV-01**: Commands (`commands/gsd/*.md`) converted to Copilot skills (`.github/skills/gsd-*/SKILL.md`)
- [x] **CONV-02**: `allowed-tools` YAML list converted to single comma-separated string in skills frontmatter
- [x] **CONV-03**: Agents (`agents/gsd-*.md`) copied to `.github/agents/gsd-*.agent.md` with extension rename
- [x] **CONV-04**: Agent `tools:` converted from comma-separated plain names to JSON array format (`['read', 'edit', 'execute', 'search']`)
- [x] **CONV-05**: Tool name mapping applied: Read→read, Write→edit, Edit→edit, Bash→execute, Grep→search, Glob→search, Task→agent, WebSearch→web, WebFetch→web, TodoWrite→todo, AskUserQuestion→(removed or mapped)
- [x] **CONV-06**: All `~/.claude/` and `./.claude/` path references replaced with `.github/`
- [x] **CONV-07**: Command name conversion: `gsd:name` → `gsd-name` in all content
- [x] **CONV-08**: Core `get-shit-done/` directory (bin, references, templates, workflows) copied to `.github/get-shit-done/`
- [x] **CONV-09**: Router skill generated at `.github/skills/get-shit-done/SKILL.md` (meta-skill for `/gsd-*` routing)
- [x] **CONV-10**: CHANGELOG.md and VERSION file written to `.github/get-shit-done/`

### Instructions

- [x] **INST-01**: `copilot-instructions.md` generated/updated at `.github/copilot-instructions.md` with GSD instructions
- [x] **INST-02**: Smart marker-based merging preserves existing user content in `copilot-instructions.md` (uses `<!-- GSD Configuration -->` markers)

### Lifecycle

- [x] **LIFE-01**: Uninstall support removes GSD skills, agents, get-shit-done dir from `.github/` without removing non-GSD content
- [x] **LIFE-02**: File manifest (`gsd-file-manifest.json`) written after installation for change detection
- [x] **LIFE-03**: Local patch persistence detects user modifications before reinstall, backs up to `gsd-local-patches/`

### Quality

- [ ] **QUAL-01**: Post-install verification confirms skills and agents exist in `.github/`
- [ ] **QUAL-02**: Warning if `.github/skills/` or `.github/agents/` contain non-GSD files that might conflict

## Future Requirements

Deferred to later milestones.

- **FUT-01**: Copilot-specific skill adapter header (like Codex's `<codex_skill_adapter>`)
- **FUT-02**: MCP server configuration support for Copilot agents

## Out of Scope

| Feature | Reason |
|---------|--------|
| Global installation for Copilot | Copilot CLI reads only from repo `.github/` — no global config directory exists |
| Hook system for Copilot | Copilot CLI has no hook/lifecycle event system (no settings.json, no SessionStart/PostToolUse) |
| Overwriting copilot-instructions.md | Must merge, not overwrite — users may have custom instructions |
| Auto-converting tool names in agent body text | Body text is prompt engineering; only frontmatter `tools:` field should be converted |
| config.toml for Copilot | Copilot auto-discovers agents from `.agent.md` files directly |
| Custom command prefix | Standardize on `/gsd-*` prefix across all runtimes |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Complete |
| CLI-03 | Phase 1 | Complete |
| CLI-04 | Phase 1 | Complete |
| CLI-05 | Phase 1 | Complete |
| CLI-06 | Phase 1 | Complete |
| CONV-01 | Phase 2 | Complete |
| CONV-02 | Phase 2 | Complete |
| CONV-03 | Phase 2 | Complete |
| CONV-04 | Phase 2 | Complete |
| CONV-05 | Phase 2 | Complete |
| CONV-06 | Phase 2 | Complete |
| CONV-07 | Phase 2 | Complete |
| CONV-08 | Phase 2 | Complete |
| CONV-09 | Phase 2 | Complete |
| CONV-10 | Phase 2 | Complete |
| INST-01 | Phase 3 | Complete |
| INST-02 | Phase 3 | Complete |
| LIFE-01 | Phase 3 | Complete |
| LIFE-02 | Phase 3 | Complete |
| LIFE-03 | Phase 3 | Complete |
| QUAL-01 | Phase 4 | Pending |
| QUAL-02 | Phase 4 | Pending |

**Coverage:**
- v1.23 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
