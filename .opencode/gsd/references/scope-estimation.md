<scope_estimation>
Plans must maintain consistent quality from first task to last. This requires understanding quality degradation and splitting aggressively.

<quality_insight>
Claude degrades when it *perceives* context pressure and enters "completion mode."

| Context Usage | Quality | Claude's State |
|---------------|---------|----------------|
| 0-30% | PEAK | Thorough, comprehensive |
| 30-50% | GOOD | Confident, solid work |
| 50-70% | DEGRADING | Efficiency mode begins |
| 70%+ | POOR | Rushed, minimal |

**The 40-50% inflection point:** Claude sees context mounting and thinks "I'd better conserve now." Result: "I'll complete the remaining tasks more concisely" = quality crash.

**The rule:** Stop BEFORE quality degrades, not at context limit.
</quality_insight>

<context_target>
**Plans should complete within ~50% of context usage.**

Why 50% not 80%?
- No context anxiety possible
- Quality maintained start to finish
- Room for unexpected complexity
- If you target 80%, you've already spent 40% in degradation mode
</context_target>

<task_rule>
**Each plan: 2-3 tasks maximum. Stay under 50% context.**

| Task Complexity | Tasks/Plan | Context/Task | Total |
|-----------------|------------|--------------|-------|
| Simple (CRUD, config) | 3 | ~10-15% | ~30-45% |
| Complex (auth, payments) | 2 | ~20-30% | ~40-50% |
| Very complex (migrations, refactors) | 1-2 | ~30-40% | ~30-50% |

**When in doubt: Default to 2 tasks.** Better to have an extra plan than degraded quality.
</task_rule>

<tdd_plans>
**TDD features get their own plans. Target ~40% context.**

TDD requires 2-3 execution cycles (RED → GREEN → REFACTOR), each with file reads, test runs, and potential debugging. This is fundamentally heavier than linear task execution.

| TDD Feature Complexity | Context Usage |
|------------------------|---------------|
| Simple utility function | ~25-30% |
| Business logic with edge cases | ~35-40% |
| Complex algorithm | ~40-50% |

**One feature per TDD plan.** If features are trivial enough to batch, they're trivial enough to skip TDD.

**Why TDD plans are separate:**
- TDD consumes 40-50% context for a single feature
- Dedicated plans ensure full quality throughout RED-GREEN-REFACTOR
- Each TDD feature gets fresh context, peak quality

See `~/.config/opencode/gsd/references/tdd.md` for TDD plan structure.
</tdd_plans>

<split_signals>

<always_split>
- **More than 3 tasks** - Even if tasks seem small
- **Multiple subsystems** - DB + API + UI = separate plans
- **Any task with >5 file modifications** - Split by file groups
- **Checkpoint + implementation work** - Checkpoints in one plan, implementation after in separate plan
- **Discovery + implementation** - DISCOVERY.md in one plan, implementation in another
</always_split>

<consider_splitting>
- Estimated >5 files modified total
- Complex domains (auth, payments, data modeling)
- Any uncertainty about approach
- Natural semantic boundaries (Setup -> Core -> Features)
</consider_splitting>
</split_signals>

<splitting_strategies>
**Vertical slices (default):** Group by feature, not by layer.

```
PREFER: Plan 01 = User (model + API + UI)
        Plan 02 = Product (model + API + UI)
        Plan 03 = Order (model + API + UI)

AVOID:  Plan 01 = All models
        Plan 02 = All APIs (depends on 01)
        Plan 03 = All UIs (depends on 02)
```

Vertical slices maximize parallelism: [01, 02, 03] run simultaneously.
Horizontal layers force sequential execution: 01 → 02 → 03.

**By dependency:** Only when genuine dependencies exist.
```
Plan 01: Auth foundation (middleware, JWT utils)
Plan 02: Protected features (uses auth from 01)
```

**By complexity:** When one slice is much heavier.
```
Plan 01: Dashboard layout shell
Plan 02: Data fetching and state
Plan 03: Visualization components
```
</splitting_strategies>

<dependency_awareness>
**Plans declare dependencies explicitly via frontmatter.**

```yaml
# Independent plan (Wave 1 candidate)
depends_on: []
files_modified: [src/features/user/model.ts, src/features/user/api.ts]
autonomous: true

# Dependent plan (later wave)
depends_on: ["03-01"]
files_modified: [src/integration/stripe.ts]
autonomous: true
```

**Wave assignment rules:**
- `depends_on: []` + no file conflicts → Wave 1 (parallel)
- `depends_on: ["XX"]` → runs after plan XX completes
- Shared `files_modified` with sibling → sequential (by plan number)

**SUMMARY references:**
- Only reference prior SUMMARY if genuinely needed (imported types, decisions affecting this plan)
- Independent plans need NO prior SUMMARY references
- Reflexive chaining (02 refs 01, 03 refs 02) is an anti-pattern
</dependency_awareness>

<file_ownership>
**Exclusive file ownership prevents conflicts:**

```yaml
# Plan 01 frontmatter
files_modified: [src/models/user.ts, src/api/users.ts, src/components/UserList.tsx]

# Plan 02 frontmatter
files_modified: [src/models/product.ts, src/api/products.ts, src/components/ProductList.tsx]
```

No overlap → can run parallel.

**If file appears in multiple plans:** Later plan depends on earlier (by plan number).
**If file cannot be split:** Plans must be sequential for that file.
</file_ownership>

<anti_patterns>
**Bad - Comprehensive plan:**
```
Plan: "Complete Authentication System"
Tasks: 8 (models, migrations, API, JWT, middleware, hashing, login form, register form)
Result: Task 1-3 good, Task 4-5 degrading, Task 6-8 rushed
```

**Good - Atomic plans:**
```
Plan 1: "Auth Database Models" (2 tasks)
Plan 2: "Auth API Core" (3 tasks)
Plan 3: "Auth API Protection" (2 tasks)
Plan 4: "Auth UI Components" (2 tasks)
Each: 30-40% context, peak quality, atomic commits
```

**Bad - Horizontal layers (sequential):**
```
Plan 01: Create User model, Product model, Order model
Plan 02: Create /api/users, /api/products, /api/orders
Plan 03: Create UserList UI, ProductList UI, OrderList UI
```
Result: 02 depends on 01, 03 depends on 02
Waves: [01] → [02] → [03] (fully sequential)

**Good - Vertical slices (parallel):**
```
Plan 01: User feature (model + API + UI)
Plan 02: Product feature (model + API + UI)
Plan 03: Order feature (model + API + UI)
```
Result: Each plan self-contained, no file overlap
Waves: [01, 02, 03] (all parallel)
</anti_patterns>

<estimating_context>
| Files Modified | Context Impact |
|----------------|----------------|
| 0-3 files | ~10-15% (small) |
| 4-6 files | ~20-30% (medium) |
| 7+ files | ~40%+ (large - split) |

| Complexity | Context/Task |
|------------|--------------|
| Simple CRUD | ~15% |
| Business logic | ~25% |
| Complex algorithms | ~40% |
| Domain modeling | ~35% |

**2 tasks:** Simple ~30%, Medium ~50%, Complex ~80% (split)
**3 tasks:** Simple ~45%, Medium ~75% (risky), Complex 120% (impossible)
</estimating_context>

<depth_calibration>
**Depth controls compression tolerance, not artificial inflation.**

| Depth | Typical Phases | Typical Plans/Phase | Tasks/Plan |
|-------|----------------|---------------------|------------|
| Quick | 3-5 | 1-3 | 2-3 |
| Standard | 5-8 | 3-5 | 2-3 |
| Comprehensive | 8-12 | 5-10 | 2-3 |

Tasks/plan is CONSTANT at 2-3. The 50% context rule applies universally.

**Key principle:** Derive from actual work. Depth determines how aggressively you combine things, not a target to hit.

- Comprehensive auth = 8 plans (because auth genuinely has 8 concerns)
- Comprehensive "add favicon" = 1 plan (because that's all it is)

Don't pad small work to hit a number. Don't compress complex work to look efficient.

**Comprehensive depth example:**
Auth system at comprehensive depth = 8 plans (not 3 big ones):
- 01: DB models (2 tasks)
- 02: Password hashing (2 tasks)
- 03: JWT generation (2 tasks)
- 04: JWT validation middleware (2 tasks)
- 05: Login endpoint (2 tasks)
- 06: Register endpoint (2 tasks)
- 07: Protected route patterns (2 tasks)
- 08: Auth UI components (3 tasks)

Each plan: fresh context, peak quality. More plans = more thoroughness, same quality per plan.
</depth_calibration>

<summary>
**2-3 tasks, 50% context target:**
- All tasks: Peak quality
- Git: Atomic per-task commits
- Parallel by default: Fresh context per subagent

**The principle:** Aggressive atomicity. More plans, smaller scope, consistent quality.

**The rules:**
- If in doubt, split. Quality over consolidation.
- Depth increases plan COUNT, never plan SIZE.
- Vertical slices over horizontal layers.
- Explicit dependencies via `depends_on` frontmatter.
- Autonomous plans get parallel execution.

**Commit rule:** Each plan produces 3-4 commits total (2-3 task commits + 1 docs commit).
</summary>
</scope_estimation>
