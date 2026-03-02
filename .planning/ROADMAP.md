# Roadmap: v1.23 Copilot CLI Support

## Overview

Add GitHub Copilot CLI as the 5th supported runtime in the GSD installer. The work follows a strict dependency chain: first make Copilot selectable (CLI plumbing), then make it produce correct output (content conversion), then complete the lifecycle (instructions, uninstall, manifest), then validate everything against the reference implementation in `.github/`. Copilot is architecturally unique as the first local-only runtime — it writes to `.github/` in the repo, not a home directory.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Installer Plumbing** - Make Copilot selectable as a runtime via CLI flags, prompts, and directory resolution
- [ ] **Phase 2: Content Conversion Engine** - Convert commands to skills, agents to `.agent.md`, with tool mapping and path replacement
- [ ] **Phase 3: Instructions & Lifecycle** - Generate copilot-instructions.md with smart merging, add uninstall/manifest/patch support
- [ ] **Phase 4: Integration Testing & Validation** - Verify installer output matches reference implementation, add post-install checks

## Phase Details

### Phase 1: Core Installer Plumbing
**Goal**: Users can select Copilot as a runtime through the installer CLI, with local-only enforcement
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06
**Success Criteria** (what must be TRUE):
  1. Running `node bin/install.js --copilot` begins a Copilot installation targeting `.github/` without errors
  2. Interactive runtime prompt shows Copilot as a numbered option with "All" renumbered correctly
  3. Running `node bin/install.js --copilot --global` exits with a clear error explaining Copilot is local-only
  4. Running `node bin/install.js --all` includes Copilot installation alongside all 4 existing runtimes
  5. `--help` output and banner display include Copilot in the runtime list and examples
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Add Copilot as 5th runtime (arg parsing, directory resolution, prompt, install/uninstall, banner/help, tests)

### Phase 2: Content Conversion Engine
**Goal**: Copilot installation produces correctly formatted skills, agents, and supporting files in `.github/`
**Depends on**: Phase 1
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09, CONV-10
**Success Criteria** (what must be TRUE):
  1. All 32 GSD commands appear as `.github/skills/gsd-*/SKILL.md` with correct frontmatter (comma-separated `allowed-tools` string, no Codex adapter headers)
  2. All 11 GSD agents appear as `.github/agents/gsd-*.agent.md` with `tools:` in JSON array format (`['tool1', 'tool2']`) and correct tool name mapping applied
  3. All path references in generated files use `.github/` instead of `~/.claude/` or `./.claude/`, and command references use `gsd-name` format instead of `gsd:name`
  4. Router skill exists at `.github/skills/get-shit-done/SKILL.md` providing `/gsd-*` command discovery
  5. Core engine files (bin, references, templates, workflows) plus CHANGELOG.md and VERSION exist in `.github/get-shit-done/`
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Instructions & Lifecycle
**Goal**: Copilot installation is complete with system instructions, uninstall support, and safe reinstall capability
**Depends on**: Phase 2
**Requirements**: INST-01, INST-02, LIFE-01, LIFE-02, LIFE-03
**Success Criteria** (what must be TRUE):
  1. `.github/copilot-instructions.md` contains GSD instructions within `<!-- GSD Configuration -->` markers, preserving any existing user content outside markers
  2. Running uninstall removes all GSD skills, agents, and `get-shit-done/` directory from `.github/` without touching non-GSD content
  3. `gsd-file-manifest.json` is written after installation listing all installed files with checksums for change detection
  4. Reinstall detects user-modified files and backs them up to `gsd-local-patches/` before overwriting
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Integration Testing & Validation
**Goal**: Copilot installer output is verified correct against the reference implementation in `.github/`
**Depends on**: Phase 3
**Requirements**: QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. Post-install verification confirms all expected skills and agents exist in `.github/` and reports pass/fail
  2. Installer warns when `.github/skills/` or `.github/agents/` contain non-GSD files that might conflict
  3. Full install in `/tmp` test directory produces output that matches the reference implementation via diff comparison (skills, agents, instructions, manifest)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Installer Plumbing | 0/? | Not started | - |
| 2. Content Conversion Engine | 0/? | Not started | - |
| 3. Instructions & Lifecycle | 0/? | Not started | - |
| 4. Integration Testing & Validation | 0/? | Not started | - |
