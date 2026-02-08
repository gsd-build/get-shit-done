# GSD Context Optimization: Action Plan

## Consensus Across All Syntheses

All three proposals agree on the first two phases. Divergence begins at Phase 3 (how far to push deterministic orchestration). This plan executes the consensus first, then evaluates before committing to architectural changes.

---

## Phase 1: Quick Wins (Do First)
**Why first:** Highest ROI, lowest risk, validates the approach before bigger changes.

### 1.1 History Digest
**What:** Add `gsd-tools history-digest` command that extracts frontmatter from SUMMARY.md files into a structured JSON.

**Why:** 10 summaries = 500-1000 lines → 2KB JSON. 80-90% reduction in history context.

**Implementation:**
```javascript
// bin/gsd-tools.js
case 'history-digest':
  const summaries = glob.sync('.planning/phases/*/*-SUMMARY.md');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  for (const file of summaries) {
    const frontmatter = extractFrontmatter(file);
    // Extract: provides, patterns, affects, decisions, tech-stack
  }

  console.log(JSON.stringify(digest, null, 2));
```

**Acceptance:** Planner uses digest instead of reading full summaries.

---

### 1.2 Atomic State Operations
**What:** Add `gsd-tools state get <section>` and `gsd-tools state patch --key value`.

**Why:** Agents currently hold full STATE.md (50-100 lines) throughout execution. Patch operations read/write only what's needed.

**Implementation:**
```javascript
case 'state':
  if (args[1] === 'get') {
    // Return specific section as JSON
  }
  if (args[1] === 'patch') {
    // Parse flags, apply atomic updates
  }
```

**Acceptance:** Executor uses `state patch` instead of rewriting full file.

---

### 1.3 Summary Template Variants
**What:** Create three templates: `summary-minimal.md` (~30 lines), `summary-standard.md` (~60 lines), `summary-complex.md` (~100 lines).

**Why:** A 2-task config change doesn't need a 114-line summary template.

**Selection logic:**
- Minimal: ≤2 tasks, ≤3 files, no decisions
- Complex: Has decisions OR >6 files
- Standard: Everything else

**Acceptance:** Executor selects template based on plan metadata.

---

### 1.4 Finish Compound Init Sweep
**What:** Ensure all major workflows use compound init calls.

**Why:** Already proven in v1.12.x. Consolidates 5-10 atomic calls into single payload.

**Targets:** `new-project.md`, `complete-milestone.md`, `verify-work.md`, `transition.md`, `help.md`, `discuss-phase.md`

---

## Phase 2: Tiered Agent Architecture (Do Second)
**Why second:** Addresses the biggest context hogs (planner: 55KB, executor: 19KB) but requires more careful refactoring.

### 2.1 Split Executor
**What:** Extract protocols into separate reference files, load conditionally.

**Before:**
```
agents/gsd-executor.md (382 lines, ~19KB)
  - deviation_rules (60 lines) - always loaded
  - checkpoint_protocol (40 lines) - always loaded
  - tdd_execution (30 lines) - always loaded
  - continuation_handling (20 lines) - always loaded
```

**After:**
```
agents/gsd-executor-core.md (~150 lines)

references/executor/
  deviation-rules.md      # Always loaded (core identity)
  tdd-execution.md        # Loaded if task.tdd="true"
  checkpoint-protocol.md  # Loaded if task.type="checkpoint:*"
  continuation.md         # Loaded if <completed_tasks> present
```

**Loading logic:** Executor uses `@` references conditionally based on task metadata.

**Acceptance:** Executor base context drops from ~19KB to ~8KB.

---

### 2.2 Split Planner
**What:** Extract mode-specific logic into extensions.

**Before:**
```
agents/gsd-planner.md (1,116 lines, ~55KB)
```

**After:**
```
agents/gsd-planner-core.md (~300 lines)
  - role, philosophy, context_fidelity
  - task_breakdown (core)
  - plan_format
  - execution_flow (standard path)

agents/gsd-planner-ext/
  gap-closure.md    # Loaded if --gaps flag
  revision.md       # Loaded if checker issues
  tdd.md            # Loaded if TDD candidates detected
  checkpoints.md    # Loaded if phase has checkpoints
```

**Orchestrator assembles prompt dynamically based on flags and phase characteristics.**

**Acceptance:** Planner base context drops from ~55KB to ~20KB.

---

## Phase 3: Compiled Plans (Do Third)
**Why third:** Depends on stable tiered agents. Provides incremental gains on top of Phase 2.

### 3.1 Implement compile-plan
**What:** Add `gsd-tools compile-plan <path>` that:
1. Inlines all `@` references
2. Strips sections unused by this plan (no TDD tasks → remove TDD sections)
3. Outputs `.compiled.md` ready for execution

**Why:** Eliminates runtime `@` resolution. Pre-strips unused protocols.

**Staleness handling:**
- Check mtime before execution
- `.compiled.md` in .gitignore
- Recompile on GSD update

**Acceptance:** Plans execute from compiled form, ~30-40% context reduction.

---

## Phase 4: Evaluate Railroad (Decide Later)
**Why later:** High effort, architectural risk. Phases 1-3 may provide sufficient improvement.

**The question:** Should `gsd-tools` become a state machine that tells Claude "do this next" instead of Claude reading workflow files?

**Arguments for:**
- Maximum context reduction
- Deterministic execution (can't skip steps)
- LLM focuses purely on task, not process

**Arguments against:**
- Loses adaptive intelligence
- Can't handle mid-execution surprises
- Debugging split across code and prompts
- Near-total rewrite

**Decision point:** After Phase 3, measure context usage. If still >40% at task start, consider Railroad. If <40%, skip.

---

## Phase 5: Semantic Queries (Optional)
**Why optional:** gsd-memory MCP exists. Only invest here if grep-based lookups prove insufficient after other optimizations.

**What:** Extend gsd-memory with structured queries:
```javascript
gsd_memory_what_uses({ symbol: "User", type: "model" })
gsd_memory_pattern_for({ domain: "auth" })
```

**Decision point:** After Phase 3, evaluate if history/pattern lookups are still a bottleneck.

---

## Execution Order Summary

```
IMMEDIATE (Phase 1) - 1-2 days
├── 1.1 history-digest command
├── 1.2 state get/patch commands
├── 1.3 Summary template variants
└── 1.4 Compound init sweep completion

NEXT (Phase 2) - 3-5 days
├── 2.1 Split gsd-executor into core + references
└── 2.2 Split gsd-planner into core + extensions

THEN (Phase 3) - 3-5 days
└── 3.1 compile-plan command

EVALUATE (Phase 4) - Decision point
└── Measure: Is context <40%?
    └── Yes → Done
    └── No → Consider Railroad architecture

OPTIONAL (Phase 5)
└── Semantic MCP queries (only if needed)
```

---

## Success Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 | Target |
|--------|---------|---------|---------|---------|--------|
| Executor base | ~19KB | ~19KB | ~8KB | ~6KB | <8KB |
| Planner base | ~55KB | ~55KB | ~20KB | ~18KB | <20KB |
| History (10 phases) | ~20KB | ~2KB | ~2KB | ~2KB | <3KB |
| Task start context | ~25% | ~18% | ~12% | ~10% | <15% |

---

## What NOT To Do

1. **Don't implement Railroad before Phase 3 measurement.** The architectural cost is high; validate simpler solutions first.

2. **Don't compress instructional content.** The teaching content is GSD's value. Optimize *when* it loads, not *what* it says.

3. **Don't over-engineer caching.** Simple mtime checks work. No cache invalidation logic until proven necessary.

4. **Don't parallelize phases.** Each phase validates assumptions for the next. Sequential execution reduces risk.

---

## Next Action

Start Phase 1.1: Implement `gsd-tools history-digest`.
