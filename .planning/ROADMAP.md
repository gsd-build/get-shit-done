# Roadmap: GSD Plugin System

## Overview

Build a plugin architecture that lets developers extend GSD through modular, self-contained plugins. Starting with the plugin format specification, then installation mechanics, discovery, activation, and finally Docker/service support for complex plugins. Documentation ties it all together with examples ranging from simple command extensions to full service integrations.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Plugin Format Specification** - Define unified plugin structure that scales from simple to complex
- [x] **Phase 2: Plugin Installation** - Package-manager style install from git repos and local paths
- [x] **Phase 3: Plugin Discovery** - List available and installed plugins
- [x] **Phase 4: Plugin Activation** - Command-based activation with optional parameters
- [x] **Phase 5: Self-Contained Dependencies** - Docker and service support within plugin folders
- [ ] **Phase 5.1: Plugin Builder** - CLI-driven workflow for creating new plugins (INSERTED)
- [ ] **Phase 6: Documentation** - Plugin development guide with basic-to-complex examples

## Phase Details

### Phase 1: Plugin Format Specification
**Goal**: Define the unified plugin format (manifest, folder structure, file conventions) that works for both simple command-only plugins and complex plugins with services
**Depends on**: Nothing (first phase)
**Research**: Unlikely (internal design using existing GSD patterns)
**Plans**: TBD

Plans:
- [x] 01-01: Plugin manifest schema (plugin.json)
- [x] 01-02: Plugin folder structure and file conventions
- [x] 01-03: Plugin hooks and lifecycle events

### Phase 2: Plugin Installation
**Goal**: Implement `/gsd:plugin install <source>` that clones git repos or copies local paths into the plugins directory
**Depends on**: Phase 1
**Research**: Likely (git clone patterns, cross-platform concerns)
**Research topics**: Node.js git operations without dependencies, cross-platform symlink handling, install location strategy
**Plans**: TBD

Plans:
- [x] 02-01: Plugin install command and git clone logic
- [x] 02-02: Local path installation and validation
- [x] 02-03: Plugin uninstall and cleanup

### Phase 3: Plugin Discovery
**Goal**: Implement `/gsd:plugin list` showing installed plugins with status, and plugin info display
**Depends on**: Phase 2
**Research**: Unlikely (file system scanning, internal patterns)
**Plans**: TBD

Plans:
- [x] 03-01: List installed plugins with status
- [x] 03-02: Plugin info and details display

### Phase 4: Plugin Activation
**Goal**: Enable/disable plugins, integrate plugin commands into GSD command namespace
**Depends on**: Phase 3
**Research**: Unlikely (command system already exists, extending it)
**Plans**: TBD

Plans:
- [x] 04-01: Plugin enable/disable commands
- [x] 04-02: Plugin command namespace integration

### Phase 5: Self-Contained Dependencies
**Goal**: Support plugins that include Docker containers and services, with automatic lifecycle management
**Depends on**: Phase 4
**Research**: Likely (Docker integration patterns)
**Research topics**: Docker Compose orchestration from Node.js, container lifecycle management, health checks
**Plans**: TBD

Plans:
- [x] 05-01: Docker Compose detection and lifecycle hooks
- [x] 05-02: Service health checks and status reporting
- [x] 05-03: Container cleanup on plugin uninstall

### Phase 5.1: Plugin Builder (INSERTED)
**Goal**: `/gsd:plugin-build-new` command that guides users through creating plugins using GSD's own workflow patterns
**Depends on**: Phase 5
**Research**: Unlikely (internal GSD patterns, workflow design)
**Plans**: 2

**Concept:**
- Workflow at `~/.claude/get-shit-done/workflows/plugin-builder.md`
- Hybrid interaction: questions for key decisions, automatic file generation
- Supports full stack: commands, hooks, Docker services
- Uses GSD's existing patterns (AskUserQuestion, templates, workflows)
- Generates complete plugin structure based on user's answers

Plans:
- [ ] 05.1-01: Plugin builder workflow and component templates
- [ ] 05.1-02: Plugin-build-new command implementation

### Phase 6: Documentation
**Goal**: Comprehensive plugin development guide with examples from simple to complex
**Depends on**: Phase 5.1
**Research**: Unlikely (documentation only)
**Plans**: TBD

Plans:
- [ ] 06-01: Plugin developer guide
- [ ] 06-02: Example plugins (simple command, medium workflow, complex with Docker)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Format Specification | 3/3 | Complete | 2026-01-16 |
| 2. Plugin Installation | 3/3 | Complete | 2026-01-16 |
| 3. Plugin Discovery | 2/2 | Complete | 2026-01-16 |
| 4. Plugin Activation | 2/2 | Complete | 2026-01-16 |
| 5. Self-Contained Dependencies | 3/3 | Complete | 2026-01-16 |
| 5.1 Plugin Builder (INSERTED) | 0/? | Not started | - |
| 6. Documentation | 0/2 | Not started | - |
