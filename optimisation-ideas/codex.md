# GSD Context Optimization Strategy

> Reducing context load while maintaining (or improving) execution quality.

## Current State Analysis

### Context Budget Reality

| File Type | Total Size | Files | Loaded When |
|-----------|-----------|-------|-------------|
| Agents | ~197KB | 11 | Per subagent spawn |
| Workflows | ~266KB | 30 | Per command invocation |
| References | ~88KB | ~10 | Inlined in agents/workflows |
| Templates | ~114KB | ~8 | Per document creation |

**Heaviest subagents:**
- `gsd-planner`: 1,116 lines (~55KB)
- `gsd-executor`: 382 lines (~19KB)
- `gsd-phase-researcher`: ~400 lines (~20KB)

**Problem:** A simple 2-task plan execution loads the full 382-line executor prompt, including TDD flows, gap closure protocols, and checkpoint handling it won't use.

### The Quality Degradation Curve

| Context Usage | Quality | Behavior |
|---------------|---------|----------|
| 0-30% | PEAK | Thorough, comprehensive, follows all instructions |
| 30-50% | GOOD | Solid work, occasional shortcuts |
| 50-70% | DEGRADING | Efficiency mode, skips optional steps |
| 70%+ | POOR | Rushed, minimal, misses requirements |

**Current reality:** Complex phases start agents at 15-25% context just from prompt loading, before any codebase reading. This leaves less headroom for actual work.

---

## Optimization Principles

### 1. Demand Loading Over Eager Loading

Load what IS needed when it's needed, not what MIGHT be needed upfront.

**Compiler analogy:**
- Dead code elimination → Don't load TDD protocol if no TDD tasks
- Lazy evaluation → Load checkpoint protocol when checkpoint encountered
- Incremental compilation → Compile plans once, reuse compiled form

### 2. Separation of Concerns

Base prompts define WHAT to do. Extension modules define HOW for specific scenarios.

### 3. Semantic Over Syntactic

Query for meaning ("what patterns exist for auth?") instead of text ("grep for auth in all summaries").

---

## Optimization Opportunities

### O1: Lazy-Load Reference Sections

**Priority:** 1 (High impact, medium effort)

**Current state:** Agents inline all protocols regardless of need.

```markdown
# gsd-executor.md currently has:
<deviation_rules>        # 60 lines - always loaded
<checkpoint_protocol>    # 40 lines - always loaded
<tdd_execution>          # 30 lines - always loaded
<continuation_handling>  # 20 lines - always loaded
```

**Proposed state:** Base agent with conditional loading.

```markdown
# gsd-executor-core.md (~150 lines)
<role>...</role>
<execution_flow>
  <step name="execute_tasks">
    For each task:
    1. If `tdd="true"`: @~/.claude/get-shit-done/references/tdd-execution.md
    2. If `type="checkpoint:*"`: @~/.claude/get-shit-done/references/checkpoint-protocol.md
    3. Execute task...
  </step>
</execution_flow>
```

**Implementation:**

```
agents/
  gsd-executor.md           → gsd-executor-core.md (base, ~150 lines)

references/
  executor/
    deviation-rules.md      # Loaded always (core to executor identity)
    tdd-execution.md        # Loaded if task.tdd="true"
    checkpoint-protocol.md  # Loaded if task.type starts with "checkpoint:"
    continuation.md         # Loaded if <completed_tasks> in prompt
    summary-creation.md     # Loaded at plan completion
```

**Savings:** 40-50% reduction in executor base context. TDD, checkpoint, continuation references load only when task type requires them.

**Risk:** @ resolution adds file I/O. Mitigated by keeping references small (<50 lines each).

---

### O2: Tiered Agent Prompts

**Priority:** 2 (High impact, medium effort)

**Current state:** Planner has 1,116 lines covering all modes.

```markdown
# gsd-planner.md sections:
<context_fidelity>      # 55 lines
<philosophy>            # 40 lines
<discovery_levels>      # 50 lines
<task_breakdown>        # 120 lines
<dependency_graph>      # 80 lines
<scope_estimation>      # 60 lines
<plan_format>           # 110 lines
<goal_backward>         # 100 lines
<checkpoints>           # 90 lines
<tdd_integration>       # 50 lines
<gap_closure_mode>      # 80 lines
<revision_mode>         # 100 lines
<execution_flow>        # 200 lines
<structured_returns>    # 60 lines
```

**Proposed state:** Base + extensions.

```
agents/
  gsd-planner-core.md       # ~300 lines (always loaded)
    - role, philosophy, context_fidelity
    - task_breakdown (core)
    - plan_format
    - execution_flow (standard path)
    - structured_returns

  gsd-planner-ext/
    discovery.md            # ~50 lines (if new dependencies detected)
    goal-backward.md        # ~100 lines (always for now, core methodology)
    gap-closure.md          # ~80 lines (if --gaps flag)
    revision.md             # ~100 lines (if checker issues provided)
    tdd.md                  # ~50 lines (if TDD candidates detected)
    checkpoints.md          # ~90 lines (if checkpoints in phase)
```

**Orchestrator logic:**

```bash
PLANNER_PROMPT="@~/.claude/agents/gsd-planner-core.md"

if [[ "$FLAGS" == *"--gaps"* ]]; then
  PLANNER_PROMPT+="\n@~/.claude/agents/gsd-planner-ext/gap-closure.md"
fi

if [[ -n "$CHECKER_ISSUES" ]]; then
  PLANNER_PROMPT+="\n@~/.claude/agents/gsd-planner-ext/revision.md"
fi

# Detect TDD candidates from phase description
if echo "$PHASE_DESC" | grep -qiE "business logic|validation|algorithm|transform"; then
  PLANNER_PROMPT+="\n@~/.claude/agents/gsd-planner-ext/tdd.md"
fi
```

**Savings:** ~60% reduction in typical planning context. Gap closure and revision modes loaded only when triggered.

---

### O3: Frontmatter-Only History Digest

**Priority:** 3 (Medium impact, low effort)

**Current state:** Planner reads full SUMMARY.md files to understand project history.

```bash
# gsd-planner step: read_project_history
for f in .planning/phases/*/*-SUMMARY.md; do
  cat "$f"  # Full file, 50-100 lines each
done
```

**Problem:** 10 prior summaries = 500-1000 lines of context. Most is prose, deviation docs, commit lists — not needed for dependency analysis.

**Proposed state:** gsd-tools generates digest.

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js history-digest
```

**Output:**

```json
{
  "phases": {
    "01-setup": {
      "plans": ["01-01", "01-02"],
      "provides": ["Next.js app", "Prisma schema", "Auth utils"],
      "patterns": ["App Router", "Server Actions", "jose for JWT"],
      "affects": ["api", "components", "lib"]
    },
    "02-core": {
      "plans": ["02-01", "02-02", "02-03"],
      "provides": ["User CRUD", "Project CRUD", "Dashboard"],
      "patterns": ["Zod validation", "React Query"],
      "affects": ["api", "components", "hooks"]
    }
  },
  "decisions": [
    {"phase": "01-01", "decision": "Use jose over jsonwebtoken for Edge compatibility"},
    {"phase": "02-01", "decision": "Server components for data fetching, client for interactivity"}
  ],
  "tech_stack": ["next.js", "prisma", "tailwind", "jose", "zod", "react-query"]
}
```

**Planner loads:**
- 2KB digest instead of 20KB of full summaries
- Full summary only for directly-dependent phases (from `affects` field)

**Implementation:**

```javascript
// bin/gsd-tools.js
case 'history-digest':
  const summaries = glob.sync('.planning/phases/*/*-SUMMARY.md');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  for (const file of summaries) {
    const frontmatter = extractFrontmatter(file);
    const phase = frontmatter.phase;

    digest.phases[phase] = digest.phases[phase] || { plans: [], provides: [], patterns: [], affects: [] };
    digest.phases[phase].plans.push(frontmatter.plan);
    digest.phases[phase].provides.push(...(frontmatter['dependency-graph']?.provides || []));
    digest.phases[phase].patterns.push(...(frontmatter['patterns-established'] || []));
    digest.phases[phase].affects.push(...(frontmatter['dependency-graph']?.affects || []));

    if (frontmatter['key-decisions']) {
      digest.decisions.push(...frontmatter['key-decisions'].map(d => ({ phase, decision: d })));
    }

    (frontmatter['tech-stack']?.added || []).forEach(t => digest.tech_stack.add(t.name));
  }

  digest.tech_stack = [...digest.tech_stack];
  console.log(JSON.stringify(digest, null, 2));
  break;
```

**Savings:** 80-90% reduction in history context for complex projects.

---

### O4: Compiled Plans

**Priority:** 4 (Medium impact, medium effort)

**Current state:** Every plan has `@` references resolved at runtime.

```markdown
# 03-01-PLAN.md
<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>
```

**Problem:** Every executor agent re-resolves the same references. execute-plan.md alone is 354 lines.

**Proposed state:** Pre-compile plans before execution.

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js compile-plan .planning/phases/03-auth/03-01-PLAN.md
# Produces .planning/phases/03-auth/03-01-PLAN.compiled.md
```

**Compilation steps:**

1. Inline all `@` references
2. Strip sections irrelevant to this plan's tasks:
   - No TDD tasks? Remove TDD sections
   - No checkpoints? Remove checkpoint sections
   - No external services? Remove user_setup handling
3. Minify prose (optional): Remove example sections, reduce explanatory text
4. Output ready-to-execute prompt

**Executor spawning:**

```bash
# Before: Agent resolves references
PLAN_CONTENT=$(cat "$PLAN_PATH")

# After: Pre-compiled, ready to execute
if [[ -f "${PLAN_PATH%.md}.compiled.md" ]]; then
  PLAN_CONTENT=$(cat "${PLAN_PATH%.md}.compiled.md")
else
  node ~/.claude/get-shit-done/bin/gsd-tools.js compile-plan "$PLAN_PATH"
  PLAN_CONTENT=$(cat "${PLAN_PATH%.md}.compiled.md")
fi
```

**Savings:** Eliminates file I/O and @-resolution overhead per agent. Pre-strips unused protocols. Estimate: 30-40% reduction in executor context for simple plans.

**Trade-off:** Compiled plans become stale if source references change. Mitigated by:
- Compile on-demand (check mtime)
- `.compiled.md` files in .gitignore
- Recompile on GSD update

---

### O5: Atomic State Operations

**Priority:** 5 (Medium impact, low effort)

**Current state:** Agents read full STATE.md, hold in context, modify at end.

```bash
# Start of execution
STATE=$(cat .planning/STATE.md)  # ~50-100 lines in context

# ... 50% context later ...

# End of execution
# Modify STATE in memory, write back
```

**Problem:**
- Full STATE.md in context throughout execution
- Risk of stale reads if parallel agents update
- Merge conflicts on concurrent writes

**Proposed state:** Patch-based operations.

```bash
# Read only what's needed
POSITION=$(node ~/.claude/get-shit-done/bin/gsd-tools.js state get position)
DECISIONS=$(node ~/.claude/get-shit-done/bin/gsd-tools.js state get decisions)

# Atomic updates
node ~/.claude/get-shit-done/bin/gsd-tools.js state patch \
  --position "Phase: 03, Plan: 02, Status: Complete" \
  --add-decision "Used jose for JWT per Edge runtime constraints" \
  --set-session "Last: 2024-01-15, Stopped: 03-02, Resume: 03-03-PLAN.md"
```

**Implementation:**

```javascript
// bin/gsd-tools.js
case 'state':
  const subcommand = args[1]; // 'get' or 'patch'
  const statePath = '.planning/STATE.md';

  if (subcommand === 'get') {
    const section = args[2]; // 'position', 'decisions', 'session', etc.
    const content = fs.readFileSync(statePath, 'utf8');
    const parsed = parseStateSection(content, section);
    console.log(JSON.stringify(parsed));
  }

  if (subcommand === 'patch') {
    // Parse --position, --add-decision, --set-session flags
    // Read file, apply patches, write back atomically
    // Use file locking for concurrent safety
  }
  break;
```

**Savings:** Agents don't hold full STATE.md in context. Reduces context by ~1-2KB per agent. Prevents concurrent update conflicts.

---

### O6: Smart Summary Templates

**Priority:** 6 (Low impact, low effort)

**Current state:** One summary template for all plan types.

```markdown
# summary.md template - 114 lines
# Includes: frontmatter, title, overview, task details, deviations,
# auth gates, verification, self-check, key files, next steps
```

**Problem:** A simple config change produces the same verbose summary as a complex auth implementation.

**Proposed state:** Template variants.

```
templates/
  summary-minimal.md    # ~30 lines - config, simple CRUD
  summary-standard.md   # ~60 lines - typical features
  summary-complex.md    # ~100 lines - architectural changes, decisions
```

**Selection heuristic:**

```javascript
function selectSummaryTemplate(plan) {
  const taskCount = plan.tasks.length;
  const hasDecisions = plan.tasks.some(t => t.type.includes('decision'));
  const hasDeviations = plan.deviations?.length > 0;
  const fileCount = plan.files_modified?.length || 0;

  if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
    return 'summary-minimal.md';
  }
  if (hasDecisions || hasDeviations || fileCount > 6) {
    return 'summary-complex.md';
  }
  return 'summary-standard.md';
}
```

**Savings:** Reduces summary creation context by 30-60% for simple plans. Executor doesn't load 114-line template for a 2-task config change.

---

### O7: MCP Semantic Queries

**Priority:** 7 (Medium impact, high effort)

**Current state:** Context loading via grep and file reads.

```bash
# Find what uses User model
grep -r "User" .planning/phases/*/*-SUMMARY.md

# Find auth patterns
grep -r "auth\|jwt\|session" .planning/phases/*/*-SUMMARY.md
```

**Problem:** Text matching returns noise. "User" matches "user experience", "user-facing", etc.

**Proposed state:** Extend gsd-memory MCP with semantic queries.

```javascript
// New MCP tools
gsd_memory_what_uses({ symbol: "User", type: "model" })
// Returns: ["03-01-SUMMARY.md", "04-02-SUMMARY.md"] with context

gsd_memory_pattern_for({ domain: "auth" })
// Returns: { library: "jose", approach: "httpOnly cookies", refresh: "7d rotation" }

gsd_memory_decisions_affecting({ subsystem: "api" })
// Returns: [{ phase: "01-02", decision: "Server Actions over API routes" }]
```

**Implementation approach:**

1. Index summaries on write (post-commit hook or gsd-tools trigger)
2. Store in SQLite with FTS5 for text search + JSON fields for structured data
3. Expose via MCP tools
4. Agents query instead of grep

**Savings:** Precise context retrieval. Agent gets exactly what it needs, no noise. Estimate: 50% reduction in history-loading context for large projects.

**Trade-off:** Significant implementation effort. Index maintenance. SQLite dependency.

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)

1. **O3: Frontmatter digest** - Add `gsd-tools history-digest`
2. **O5: State patch operations** - Add `gsd-tools state get/patch`
3. **O6: Summary template variants** - Create minimal/standard/complex

### Phase 2: Architecture Changes (3-5 days)

4. **O1: Lazy-load references** - Restructure executor into core + references
5. **O2: Tiered agent prompts** - Restructure planner into core + extensions

### Phase 3: Build System (3-5 days)

6. **O4: Compiled plans** - Add `gsd-tools compile-plan` with smart stripping

### Phase 4: Semantic Layer (5-10 days)

7. **O7: MCP semantic queries** - Extend gsd-memory with structured queries

---

## Metrics

### Before/After Tracking

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Executor base context | ~19KB | ~8KB | `wc -c agents/gsd-executor*.md` |
| Planner base context | ~55KB | ~20KB | `wc -c agents/gsd-planner*.md` |
| History loading (10 phases) | ~20KB | ~2KB | Digest size vs full summaries |
| Plan execution start context | ~25% | ~12% | Log context % at first task |

### Quality Indicators

- Plans completing within 50% context (target: 95%+)
- Verification pass rate (should stay same or improve)
- Deviation rate (should stay same)
- User checkpoint fatigue (fewer "skip" responses)

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Lazy loading adds latency | Keep references <50 lines, cache resolved content |
| Tiered prompts miss edge cases | Comprehensive testing, fallback to full prompt |
| Compiled plans become stale | Mtime checks, recompile on source change |
| Semantic queries require maintenance | Auto-index on summary creation, periodic reindex |
| Breaking changes during refactor | Feature flags, A/B testing old vs new paths |

---

## Success Criteria

1. **Context efficiency:** Average plan execution uses <40% context (down from ~55%)
2. **Quality maintenance:** Verification pass rate stays ≥95%
3. **Speed:** No measurable latency increase from lazy loading
4. **Maintainability:** Clear separation between core and extensions
5. **Debuggability:** Easy to trace which modules were loaded for any execution

---

## Appendix: File Structure After Optimization

```
agents/
  gsd-executor-core.md          # Base executor (~150 lines)
  gsd-planner-core.md           # Base planner (~300 lines)
  gsd-planner-ext/
    discovery.md
    gap-closure.md
    revision.md
    tdd.md
    checkpoints.md
  gsd-verifier.md               # Already lean
  gsd-phase-researcher.md       # Candidate for similar treatment
  ...

references/
  executor/
    deviation-rules.md
    tdd-execution.md
    checkpoint-protocol.md
    continuation.md
    summary-creation.md
  planner/
    goal-backward.md            # Core methodology, always loaded
  checkpoints.md                # Existing, used by multiple agents
  tdd.md                        # Existing

templates/
  summary-minimal.md
  summary-standard.md
  summary-complex.md
  ...

bin/
  gsd-tools.js
    # Existing commands
    + history-digest            # O3
    + state get/patch           # O5
    + compile-plan              # O4
    + select-template           # O6
```
