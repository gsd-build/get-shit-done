# Roadmap

## Domain Expertise

None

## Milestone: v1.0 — OpenCode Port

Full feature parity port of GSD to support both Claude Code and OpenCode platforms.

### Phases

#### Phase 1: OpenCode Research
**Goal:** Understand OpenCode conventions and map equivalents from Claude Code

**Scope:**
- Research OpenCode directory structure (`.opencode/command/`, `.opencode/agent/`)
- Document YAML frontmatter differences (`allowed-tools` → `tools`)
- Map all 26 commands to OpenCode equivalents
- Design shared source architecture

**Research:** Likely (new platform integration)
**Research topics:** OpenCode directory conventions, YAML frontmatter schema, agent definition format, tool declarations

**Dependencies:** None
**Status:** Complete (1/1 plans)
**Plans:**
- [x] 01-01: OpenCode Research & Mapping

---

#### Phase 2: Multi-Agent Installer
**Goal:** Modify install.js to support both Claude Code and OpenCode

**Scope:**
- Add platform selection prompt (Claude Code / OpenCode)
- Implement OpenCode installation paths (`.opencode/command/`, `.opencode/agent/`)
- Handle frontmatter transformation during install
- Maintain backwards compatibility with existing Claude Code installs

**Research:** Unlikely (internal Node.js work using established patterns)

**Dependencies:** Phase 1 (need to understand OpenCode structure first)
**Status:** Complete (1/1 plans)
**Plans:**
- [x] 02-01: Multi-Agent Installer

---

#### Phase 3: Command Adaptation
**Goal:** Ensure all commands and workflows work on OpenCode

**Scope:**
- Adapt command frontmatter for OpenCode format
- Create OpenCode agent definitions if required
- Test workflow execution on OpenCode
- Handle any platform-specific differences in execution

**Research:** Likely (format differences may require adjustment)
**Research topics:** OpenCode command execution model, agent spawning patterns

**Dependencies:** Phase 2 (need installer working first)
**Status:** Complete (1/1 plans)
**Plans:**
- [x] 03-01: Command Adaptation

---

#### Phase 4: Validation
**Goal:** Verify feature parity and document usage

**Scope:**
- Test all 26 commands on both platforms
- Verify parallel execution works on OpenCode
- Update README with dual-platform instructions
- Create platform-specific troubleshooting guide

**Research:** Unlikely (testing existing work)

**Dependencies:** Phase 3
**Status:** Complete (2/2 plans)
**Completed:** 2026-01-14
**Plans:**
- [x] 04-01: Command Test Matrix
- [x] 04-02: Documentation Update

---

## Progress

| Phase | Status | Plans | Completed |
|-------|--------|-------|-----------|
| 1. OpenCode Research | Complete | 1/1 | 2026-01-14 |
| 2. Multi-Agent Installer | Complete | 1/1 | 2026-01-14 |
| 3. Command Adaptation | Complete | 1/1 | 2026-01-14 |
| 4. Validation | Complete | 2/2 | 2026-01-14 |

---
*Last updated: 2026-01-14 after Phase 4 completion*
