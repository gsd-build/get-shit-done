# Requirements: GSD Context Optimization

**Defined:** 2025-02-07
**Core Value:** Agents execute at peak quality by starting at 8-12% context instead of 15-25%

## v1 Requirements

### History Digest

- [ ] **HIST-01**: `gsd-tools history-digest` generates structured JSON from SUMMARY.md frontmatter
- [ ] **HIST-02**: Digest includes phases, provides, patterns, affects, decisions, and tech_stack
- [ ] **HIST-03**: Planner uses digest instead of reading full SUMMARY.md files
- [ ] **HIST-04**: Tests verify digest output matches expected schema

### Summary Variants

- [ ] **SUMM-01**: Three summary templates exist: minimal (~30 lines), standard (~60 lines), complex (~100 lines)
- [ ] **SUMM-02**: `gsd-tools select-template` returns appropriate template based on plan complexity
- [ ] **SUMM-03**: Selection logic considers task count, decision tasks, and file count
- [ ] **SUMM-04**: Executor uses selected template for summary creation
- [ ] **SUMM-05**: Tests verify template selection logic

### Atomic State Operations

- [ ] **STATE-01**: `gsd-tools state get <field>` returns specific STATE.md field value
- [ ] **STATE-02**: `gsd-tools state patch --field value` updates specific fields atomically
- [ ] **STATE-03**: Agents use atomic ops instead of full STATE.md read/write
- [ ] **STATE-04**: Tests verify get/patch operations

### Lazy-Load Executor

- [ ] **EXEC-01**: `gsd-executor-core.md` contains base executor (~150 lines)
- [ ] **EXEC-02**: `references/executor/` contains modular references (deviation-rules, tdd, checkpoint, continuation, summary-creation)
- [ ] **EXEC-03**: Executor loads TDD reference only when task.tdd="true"
- [ ] **EXEC-04**: Executor loads checkpoint reference only when task.type="checkpoint:*"
- [ ] **EXEC-05**: Executor loads continuation reference only when <completed_tasks> present
- [ ] **EXEC-06**: Executor loads summary-creation reference at plan completion

### Tiered Planner

- [ ] **PLAN-01**: `gsd-planner-core.md` contains base planner (~300 lines)
- [ ] **PLAN-02**: `gsd-planner-ext/` contains extensions (gap-closure, revision, tdd, checkpoints)
- [ ] **PLAN-03**: Orchestrator builds prompt dynamically based on flags and context
- [ ] **PLAN-04**: Gap-closure extension loads only with --gaps flag
- [ ] **PLAN-05**: Revision extension loads only when checker issues exist
- [ ] **PLAN-06**: TDD extension loads only when TDD candidates detected

### Compiled Plans

- [ ] **COMP-01**: `gsd-tools compile-plan` inlines all @ references
- [ ] **COMP-02**: Compilation strips irrelevant sections based on task types
- [ ] **COMP-03**: Compiled plans saved as .compiled.md
- [ ] **COMP-04**: Executor uses compiled version when available
- [ ] **COMP-05**: Staleness detection via mtime comparison
- [ ] **COMP-06**: Tests verify compilation output

## v2 Requirements

### Enhanced Semantic Queries

- **SEM-01**: gsd-memory MCP supports structured queries (what_uses, pattern_for, decisions_affecting)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Compressing instructional content | Core methodology must remain intact |
| Complex cache invalidation | Simple mtime checks are sufficient |
| Railroad architecture | Loses adaptive intelligence |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HIST-01 | Phase 1 | Pending |
| HIST-02 | Phase 1 | Pending |
| HIST-03 | Phase 1 | Pending |
| HIST-04 | Phase 1 | Pending |
| SUMM-01 | Phase 2 | Pending |
| SUMM-02 | Phase 2 | Pending |
| SUMM-03 | Phase 2 | Pending |
| SUMM-04 | Phase 2 | Pending |
| SUMM-05 | Phase 2 | Pending |
| STATE-01 | Phase 3 | Pending |
| STATE-02 | Phase 3 | Pending |
| STATE-03 | Phase 3 | Pending |
| STATE-04 | Phase 3 | Pending |
| EXEC-01 | Phase 4 | Pending |
| EXEC-02 | Phase 4 | Pending |
| EXEC-03 | Phase 4 | Pending |
| EXEC-04 | Phase 4 | Pending |
| EXEC-05 | Phase 4 | Pending |
| EXEC-06 | Phase 4 | Pending |
| PLAN-01 | Phase 5 | Pending |
| PLAN-02 | Phase 5 | Pending |
| PLAN-03 | Phase 5 | Pending |
| PLAN-04 | Phase 5 | Pending |
| PLAN-05 | Phase 5 | Pending |
| PLAN-06 | Phase 5 | Pending |
| COMP-01 | Phase 6 | Pending |
| COMP-02 | Phase 6 | Pending |
| COMP-03 | Phase 6 | Pending |
| COMP-04 | Phase 6 | Pending |
| COMP-05 | Phase 6 | Pending |
| COMP-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2025-02-07*
*Last updated: 2025-02-07 after initial definition*
