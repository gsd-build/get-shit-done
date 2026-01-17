# GSD Documentation Index

> **Purpose:** Master navigation for GSD system documentation.
> **Usage:** Load this first for orientation, then load specific documents as needed for modification tasks.

---

## Quick Start

For modification tasks, load documents in this order:

1. **This index** — Navigation and document map
2. **GSD_ARCHITECTURE_SCAFFOLDING.md** — System architecture, registries, flows
3. **Relevant component doc** — Behavioral details for the specific component

**Minimal context load:** Index + Scaffolding (~3,000 tokens)
**Typical modification load:** Above + 1-2 component docs (~4,500-5,500 tokens)

---

## Document Map

### Architecture (Load First)

| Document | Location | Est. Tokens | Purpose |
|----------|----------|-------------|---------|
| GSD_ARCHITECTURE_SCAFFOLDING.md | Root | ~2,200 | System architecture, registries, flows, invariants |

**Always load this first.** Contains:
- Five Invariant Principles
- Four-Layer Architecture
- Command/Agent/Workflow/Template Registries
- Key Flows (project init, planning, execution, verification)
- Numeric Limits Quick Reference
- Anti-Pattern Quick Reference

---

### Agent References

| Agent | Tier | Est. Tokens | When to Load |
|-------|------|-------------|--------------|
| [gsd-planner](agents/gsd-planner-reference.md) | Deep | ~800 | Modifying planning logic, task breakdown, goal-backward |
| [gsd-executor](agents/gsd-executor-reference.md) | Deep | ~650 | Modifying execution, deviations, checkpoints, commits |
| [gsd-verifier](agents/gsd-verifier-reference.md) | Deep | ~800 | Modifying verification, stub detection, gap analysis |
| [gsd-plan-checker](agents/gsd-plan-checker-reference.md) | Deep | ~750 | Modifying plan validation, 6 dimensions |
| [gsd-project-researcher](agents/gsd-project-researcher-reference.md) | Standard | ~150 | Modifying project-level research |
| [gsd-phase-researcher](agents/gsd-phase-researcher-reference.md) | Standard | ~200 | Modifying phase-specific research |
| [gsd-debugger](agents/gsd-debugger-reference.md) | Standard | ~200 | Modifying scientific debugging |
| [gsd-codebase-mapper](agents/gsd-codebase-mapper-reference.md) | Standard | ~200 | Modifying brownfield analysis |
| [gsd-roadmapper](agents/gsd-roadmapper-reference.md) | Standard | ~250 | Modifying roadmap generation |
| gsd-integration-checker | Standard | — | Modifying cross-phase integration verification |
| gsd-research-synthesizer | Summary | — | Modifying research output synthesis |

**Note:** `gsd-integration-checker` (7/12 complexity) and `gsd-research-synthesizer` (6/12 complexity) exist in the system but reference documentation is pending. See FILE_MANIFEST.md for source file details.

**Documentation Tiers:**
- **Deep Reference (10-12 complexity):** Full extraction — modes, constraints, mechanisms, anti-patterns, change impact
- **Standard Reference (7-9 complexity):** Key behaviors, modes, interactions, quick reference

---

### Command References

| Document | Coverage | Est. Tokens | When to Load |
|----------|----------|-------------|--------------|
| [core-commands-reference.md](commands/core-commands-reference.md) | new-project, plan-phase, execute-phase, verify-work | ~600 | Modifying primary workflow commands |
| [secondary-commands-reference.md](commands/secondary-commands-reference.md) | 20 supporting commands | ~650 | Modifying session, roadmap, milestone, debug, utility commands |

---

### Support References

| Document | Coverage | Est. Tokens | When to Load |
|----------|----------|-------------|--------------|
| [support-components-reference.md](support-components-reference.md) | Workflows, templates, references | ~1,100 | Modifying workflows, understanding template schemas, using references |
| [FILE_MANIFEST.md](FILE_MANIFEST.md) | Complete file inventory | ~500 | Finding file locations, understanding relationships |

---

## Modification Guides

### Adding a New Command

**Load:** Scaffolding + core-commands-reference (or secondary if similar)

**Steps:**
1. Read similar command in `commands/gsd/` as template
2. Create `commands/gsd/{name}.md` with:
   - `<command>` wrapper with name and argument-hint
   - `<allowed-tools>` section
   - Command logic in markdown
   - Structured returns
3. Update `commands/gsd/help.md` command list
4. If spawns agents, verify agent exists in `agents/`
5. Test command via `/gsd:{name}`

**Checklist:**
- [ ] Command file created with proper structure
- [ ] Help updated with command entry
- [ ] Agent spawning tested (if applicable)
- [ ] Structured returns documented

---

### Adding a New Agent

**Load:** Scaffolding + similar agent reference

**Steps:**
1. Read similar agent in `agents/` as template
2. Create `agents/gsd-{name}.md` with:
   - `<role>` section with identity
   - Core sections based on complexity (modes, constraints, flows)
   - `<structured_returns>` section
   - `<success_criteria>` section
3. Update spawning command to include new agent
4. Add output template if agent produces new file type:
   - Create `get-shit-done/templates/{output}.md`
5. Document in FILE_MANIFEST.md

**Checklist:**
- [ ] Agent file created with proper structure
- [ ] Spawning command updated
- [ ] Output template created (if needed)
- [ ] FILE_MANIFEST.md updated

---

### Modifying an Agent

**Load:** Scaffolding + agent's reference doc

**Steps:**
1. Read agent's reference doc completely
2. Identify section to modify (use Section Index)
3. Extract current constraints from source file
4. Make targeted modifications preserving:
   - All MUST/NEVER/ALWAYS constraints
   - Numeric limits
   - Structured return formats
5. Check **Change Impact Analysis** section:
   - Update downstream consumers if output changes
   - Update upstream callers if input changes
6. Test modified behavior

**Critical Constraints (from scaffolding):**
- Orchestrators ≤15% context
- Agents target ≤50% context
- Tasks per plan: 2-3 max
- Files per plan: 5-8 typical, 15+ is blocker

**Checklist:**
- [ ] Reference doc reviewed
- [ ] Constraints preserved
- [ ] Change impact assessed
- [ ] Downstream consumers updated (if needed)
- [ ] Tested

---

### Modifying State Schema

**Load:** Scaffolding + FILE_MANIFEST + support-components-reference

**Steps:**
1. Identify state file from FILE_MANIFEST (ROADMAP.md, STATE.md, etc.)
2. Find all readers/writers:
   - Check "Agent Relationships" in FILE_MANIFEST
   - Check "Template → Consumer Mapping" in support-components-reference
3. Update template in `get-shit-done/templates/`
4. Update all agents that read the field
5. Update all agents that write the field
6. Test full flow that uses state

**State File Hierarchy:**
```
.planning/
├── PROJECT.md              # Strategic (rarely changes)
├── config.json             # Strategic (workflow preferences)
├── REQUIREMENTS.md         # Strategic (scoped requirements)
├── ROADMAP.md              # Operational (phase structure)
├── STATE.md                # Operational (current position)
├── research/               # Context (domain knowledge)
├── codebase/               # Context (brownfield analysis)
└── phases/                 # Execution (plans, summaries, verification)
```

**Checklist:**
- [ ] All readers identified
- [ ] All writers identified
- [ ] Template updated
- [ ] Consumers updated
- [ ] Flow tested

---

### Modifying a Workflow

**Load:** Scaffolding + support-components-reference

**Steps:**
1. Find workflow in `get-shit-done/workflows/`
2. Check "Workflow → Output Mapping" for dependencies
3. Modify workflow preserving:
   - Output file formats
   - Downstream consumer expectations
4. If output format changes, update:
   - Template in `get-shit-done/templates/`
   - All consumers of that output

**Checklist:**
- [ ] Workflow modified
- [ ] Output format preserved (or consumers updated)
- [ ] Template updated (if output changes)

---

## Cross-Reference Matrix

### Core Flow: Commands → Agents → Outputs

| Command | Spawns | Primary Output | Consumed By |
|---------|--------|----------------|-------------|
| `/gsd:new-project` | project-researcher (×4), research-synthesizer, roadmapper | PROJECT.md, ROADMAP.md, STATE.md | plan-phase |
| `/gsd:plan-phase` | phase-researcher, planner, plan-checker | PLAN.md files | execute-phase |
| `/gsd:execute-phase` | executor (×plans), verifier | SUMMARY.md, VERIFICATION.md | verify-work, next phase |
| `/gsd:verify-work` | debugger (×issues), planner | UAT.md, gap plans | execute-phase --gaps |

### Agent Dependency Graph

```
project-researcher ────┐
                       ├──► research-synthesizer ──► roadmapper ──► ROADMAP.md
phase-researcher ──────┘                                              │
                                                                      ▼
planner ◄────────────────────────────────────────────────────────── plan-phase
   │
   ▼
plan-checker ──► (issues) ──► planner (revision mode)
   │
   ▼ (passed)
executor ──► SUMMARY.md ──► verifier ──► VERIFICATION.md
   │                            │
   │                            ▼ (gaps)
   │                       planner (gap closure mode)
   │
   └──► debugger (if issues in UAT)
```

### State File → Agent Mapping

| State File | Writers | Readers |
|------------|---------|---------|
| STATE.md | roadmapper, execute-phase, transitions | All agents (project context) |
| ROADMAP.md | roadmapper, add/insert/remove-phase | planner, plan-checker, verifier |
| PLAN.md | planner | executor, plan-checker, verifier |
| SUMMARY.md | executor | verifier, planner (gap closure), future phases |
| VERIFICATION.md | verifier | planner (gap closure), orchestrator |
| CONTEXT.md | discuss-phase | phase-researcher, planner |
| RESEARCH.md | phase-researcher | planner |

---

## Appendix: Token Budget Guide

### Load Scenarios

| Task Type | Documents to Load | Est. Tokens |
|-----------|-------------------|-------------|
| Quick lookup | Index only | ~500 |
| Architecture review | Index + Scaffolding | ~2,700 |
| Agent modification | Above + agent reference | ~3,500-4,500 |
| Command modification | Above + command reference | ~3,300-3,500 |
| Full system change | Above + multiple references | ~5,000-6,000 |

### Document Sizes

| Document | Lines | Est. Tokens |
|----------|-------|-------------|
| GSD_ARCHITECTURE_SCAFFOLDING.md | 384 | ~2,200 |
| gsd-planner-reference.md | 463 | ~800 |
| gsd-executor-reference.md | 385 | ~650 |
| gsd-verifier-reference.md | 479 | ~800 |
| gsd-plan-checker-reference.md | 475 | ~750 |
| gsd-project-researcher-reference.md | 86 | ~150 |
| gsd-phase-researcher-reference.md | 114 | ~200 |
| gsd-debugger-reference.md | 123 | ~200 |
| gsd-codebase-mapper-reference.md | 125 | ~200 |
| gsd-roadmapper-reference.md | 143 | ~250 |
| core-commands-reference.md | 341 | ~600 |
| secondary-commands-reference.md | 366 | ~650 |
| support-components-reference.md | 627 | ~1,100 |
| FILE_MANIFEST.md | 265 | ~500 |
| **Total Documentation** | ~4,376 | ~9,050 |

### Recommended Loading Strategy

**Principle:** Load minimum context needed for the task.

1. **Always start with scaffolding** — Provides architectural context
2. **Load one component doc at a time** — Deep dive as needed
3. **Use FILE_MANIFEST for navigation** — Find related files
4. **Check Change Impact before modifying** — Know what else needs updating

---

## Version

- **Documentation Version:** v1.0
- **GSD Version:** 1.5.28
- **Generated:** 2026-01-17
- **Source Files:** 84 GSD files (27,591 lines)

---

## Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| GSD_DOCUMENTATION_INDEX.md | Complete | 2026-01-17 |
| FILE_MANIFEST.md | Complete | 2026-01-17 |
| gsd-planner-reference.md | Complete | 2026-01-17 |
| gsd-executor-reference.md | Complete | 2026-01-17 |
| gsd-verifier-reference.md | Complete | 2026-01-17 |
| gsd-plan-checker-reference.md | Complete | 2026-01-17 |
| gsd-project-researcher-reference.md | Complete | 2026-01-17 |
| gsd-phase-researcher-reference.md | Complete | 2026-01-17 |
| gsd-debugger-reference.md | Complete | 2026-01-17 |
| gsd-codebase-mapper-reference.md | Complete | 2026-01-17 |
| gsd-roadmapper-reference.md | Complete | 2026-01-17 |
| gsd-integration-checker-reference.md | Pending | — |
| gsd-research-synthesizer-reference.md | Pending | — |
| core-commands-reference.md | Complete | 2026-01-17 |
| secondary-commands-reference.md | Complete | 2026-01-17 |
| support-components-reference.md | Complete | 2026-01-17 |
