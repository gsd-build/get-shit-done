# Roadmap: GSD Context Optimization

**Created:** 2025-02-07
**Phases:** 6
**Depth:** Standard
**Core Value:** Agents execute at peak quality by starting at 8-12% context instead of 15-25%

## Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | History Digest | Planner loads structured digest instead of full SUMMARY.md | HIST-01, HIST-02, HIST-03, HIST-04 | Pending |
| 2 | Summary Variants | Executor produces right-sized summaries | SUMM-01, SUMM-02, SUMM-03, SUMM-04, SUMM-05 | Pending |
| 3 | Atomic State | Agents update STATE.md fields atomically | STATE-01, STATE-02, STATE-03, STATE-04 | Pending |
| 4 | Lazy Executor | Executor loads references on-demand | EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06 | Pending |
| 5 | Tiered Planner | Planner prompt built dynamically | PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06 | Pending |
| 6 | Compiled Plans | Plans pre-compiled for minimal execution context | COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06 | Pending |

## Dependencies

```
Phase 1 ─┐
Phase 2 ─┼─► Phase 4 ─► Phase 5 ─► Phase 6
Phase 3 ─┘
```

- Phases 1, 2, 3 can run in parallel (no dependencies)
- Phase 4 depends on Phase 2 (summary templates) and Phase 3 (state ops)
- Phase 5 depends on Phase 4 (executor patterns inform planner structure)
- Phase 6 depends on Phase 4 and 5 (compilation targets both agents)

---

## Phase 1: History Digest

**Goal:** Planner loads structured digest instead of full SUMMARY.md files

**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04

### Success Criteria

1. `gsd-tools history-digest` produces valid JSON with frontmatter fields
2. Digest includes: phases, provides, patterns, affects, decisions, tech_stack
3. Planner startup no longer reads full SUMMARY.md files
4. Tests pass for digest schema validation

### Approach

- Add `history-digest` command to gsd-tools.js
- Parse SUMMARY.md frontmatter (YAML between `---` markers)
- Extract key fields into structured JSON
- Update planner to consume digest instead of full files
- TDD: Write tests first for digest output schema

---

## Phase 2: Summary Variants

**Goal:** Executor produces right-sized summaries based on plan complexity

**Requirements:** SUMM-01, SUMM-02, SUMM-03, SUMM-04, SUMM-05

### Success Criteria

1. Three template files exist: summary-minimal.md (~30 lines), summary-standard.md (~60 lines), summary-complex.md (~100 lines)
2. `gsd-tools select-template` returns appropriate template path
3. Selection considers: task count, decision tasks, file count
4. Executor uses selected template for summary creation

### Approach

- Create three summary templates with increasing detail
- Add `select-template` command with selection logic
- Update executor workflow to call select-template
- TDD: Write tests first for template selection logic

---

## Phase 3: Atomic State Operations

**Goal:** Agents update STATE.md fields atomically without full file read/write

**Requirements:** STATE-01, STATE-02, STATE-03, STATE-04

### Success Criteria

1. `gsd-tools state get <field>` returns specific STATE.md field value
2. `gsd-tools state patch --field value` updates specific fields atomically
3. Agent workflows updated to use atomic ops
4. Tests verify get/patch operations preserve file integrity

### Approach

- Add `state get` subcommand to read specific fields
- Add `state patch` subcommand for atomic field updates
- Parse STATE.md as markdown, update in place
- Update executor/planner workflows to use atomic ops
- TDD: Write tests first for get/patch operations

---

## Phase 4: Lazy-Load Executor

**Goal:** Executor loads references on-demand based on task type

**Requirements:** EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06

### Success Criteria

1. `gsd-executor-core.md` contains base executor (~150 lines)
2. `references/executor/` contains: deviation-rules.md, tdd-execution.md, checkpoint-protocol.md, continuation.md, summary-creation.md
3. TDD reference loads only when task.tdd="true"
4. Checkpoint reference loads only for task.type="checkpoint:*"
5. Continuation reference loads only when <completed_tasks> present

### Approach

- Extract current executor into core + modular references
- Core contains: role, task execution loop, basic flow
- References contain: specialized protocols for specific situations
- Add conditional @ references based on task attributes
- Measure context reduction vs current executor

---

## Phase 5: Tiered Planner

**Goal:** Planner prompt built dynamically based on planning mode

**Requirements:** PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06

### Success Criteria

1. `gsd-planner-core.md` contains base planner (~300 lines)
2. `gsd-planner-ext/` contains: gap-closure.md, revision.md, tdd.md, checkpoints.md
3. Gap-closure loads only with --gaps flag
4. Revision loads only when checker issues exist
5. TDD loads only when TDD candidates detected

### Approach

- Extract current planner into core + extensions
- Core contains: role, philosophy, task breakdown, plan format
- Extensions contain: specialized planning modes
- Update orchestrator to build prompt dynamically
- Measure context reduction vs current planner

---

## Phase 6: Compiled Plans

**Goal:** Plans pre-compiled for minimal execution context

**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06

### Success Criteria

1. `gsd-tools compile-plan` inlines all @ references
2. Compilation strips irrelevant sections based on task types in plan
3. Compiled plans saved as .compiled.md alongside original
4. Executor uses compiled version when fresh (mtime check)
5. Tests verify compilation output matches expected structure

### Approach

- Add `compile-plan` command to gsd-tools.js
- Resolve all @ references recursively
- Strip sections not relevant to this plan's tasks
- Save as PLAN.compiled.md
- Update executor to prefer compiled version
- TDD: Write tests first for compilation logic

---

## Coverage

**v1 Requirements:** 28 total
**Mapped to phases:** 28
**Unmapped:** 0 ✓

---
*Roadmap created: 2025-02-07*
*Last updated: 2025-02-07 after initial creation*
