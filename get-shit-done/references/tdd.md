<overview>
TDD is about design quality, not coverage metrics. The red-green-refactor cycle forces you to think about behavior before implementation, producing cleaner interfaces and more testable code.

**Principle:** If you can describe the behavior as `expect(fn(input)).toBe(output)` before writing `fn`, TDD improves the result.

**Key insight:** TDD work is fundamentally heavier than standard tasks—it requires 2 execution cycles (RED → GREEN), each with file reads, test runs, and potential debugging. TDD features get dedicated plans to ensure full context is available throughout the cycle.
</overview>

<when_to_use_tdd>
## When TDD Improves Quality

**TDD candidates (create a TDD plan):**
- Business logic with defined inputs/outputs
- API endpoints with request/response contracts
- Data transformations, parsing, formatting
- Validation rules and constraints
- Algorithms with testable behavior
- State machines and workflows
- Utility functions with clear specifications

**Skip TDD (use standard plan with `type="auto"` tasks):**
- UI layout, styling, visual components
- Configuration changes
- Glue code connecting existing components
- One-off scripts and migrations
- Simple CRUD with no business logic
- Exploratory prototyping

**Heuristic:** Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
→ Yes: Create a TDD plan
→ No: Use standard plan, add tests after if needed
</when_to_use_tdd>

<test_strategy>
## Test Strategy

### Acceptance Tests — Mandatory (TDD-First)

Every TDD plan MUST include acceptance tests. Write them in RED phase before implementation.

From `must_haves.truths` — prove the feature does what it should.

```typescript
// From must_haves: "Loader merges global + project rules"
test('merges global and project rules', () => {
  const result = loader.load(globalPath, projectPath)
  expect(result.rules).toContain(globalRule)
  expect(result.rules).toContain(projectRule)
})
```

### Recommended Later (Non-Blocking)

Add these to tasks that benefit from them — not every task needs all categories. Use `/gsd:add-tests` to add after TDD plans ship.

**Edge Case Tests** — for parsers, validators, data transformations:
```typescript
test('handles empty global constitution', () => ...)
test('handles malformed YAML', () => ...)
```

**Security Tests** — for auth endpoints, data access, input handling:
Based on project's `security_compliance` level from config.json.
Reference: @~/.claude/get-shit-done/references/security-compliance.md

```typescript
// For soc2 compliance
test('denies unauthenticated access', () => ...)
test('logs data access with user ID', () => ...)
```

**Performance Tests** — for critical paths, heavy queries, real-time features:
```typescript
test('loads constitution in < 100ms', async () => {
  const start = Date.now()
  await loader.load()
  expect(Date.now() - start).toBeLessThan(100)
})
```

### Plan Structure

```xml
<feature>
  <name>Constitution Loader</name>
  <files>loader.ts, loader.test.ts</files>

  <tests>
    <acceptance>
      - Merges global + project rules
      - Project rules override global
      - Version validation works
    </acceptance>
    <!-- Optional: add via /gsd:add-tests after shipping -->
    <recommended_later>
      - Edge: Empty constitution, malformed YAML, duplicate IDs
      - Security: Safe YAML parsing (no code execution)
      - Performance: Loads in < 100ms, caches after first load
    </recommended_later>
  </tests>

  <implementation>
    Minimal code to pass all tests
  </implementation>
</feature>
```

**Acceptance tests required.** Write them before ANY implementation. Edge/security/performance tests added later via `/gsd:add-tests`.
</test_strategy>

<tdd_plan_structure>
## TDD Plan Structure

Each TDD plan implements **one feature** through the RED-GREEN cycle.

```markdown
---
phase: XX-name
plan: NN
type: tdd
---

<objective>
[What feature and why]
Purpose: [Design benefit of TDD for this feature]
Output: [Working, tested feature]
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@relevant/source/files.ts
</context>

<feature>
  <name>[Feature name]</name>
  <files>[source file, test file]</files>
  <behavior>
    [Expected behavior in testable terms]
    Cases: input → expected output
  </behavior>
  <implementation>[How to implement once tests pass]</implementation>
</feature>

<verification>
[Test command that proves feature works]
</verification>

<success_criteria>
- Failing test written and committed
- Implementation passes test
- Refactor complete (optional, if obvious cleanup exists)
- Both commits present (test + feat)
</success_criteria>

<output>
After completion, create SUMMARY.md with:
- RED: What test was written, why it failed
- GREEN: What implementation made it pass
- REFACTOR: What cleanup was done (optional, if any)
- Commits: List of commits produced
</output>
```

**One feature per TDD plan.** If features are trivial enough to batch, they're trivial enough to skip TDD—use a standard plan and add tests after.
</tdd_plan_structure>

<execution_flow>
## Red-Green Cycle

**RED - Write failing test:**
1. Create test file following project conventions
2. Write test describing expected behavior (from `<behavior>` element)
3. Run test - it MUST fail
4. If test passes: feature exists or test is wrong. Investigate.
5. Commit: `test({phase}-{plan}): add failing test for [feature]`

**GREEN - Implement to pass:**
1. Write minimal code to make test pass
2. No cleverness, no optimization - just make it work
3. Run test - it MUST pass
4. Commit: `feat({phase}-{plan}): implement [feature]`

**REFACTOR (optional):** Skip unless obvious cleanup exists.
1. Clean up implementation if obvious improvements exist
2. Run tests - MUST still pass
3. Only commit if changes made: `refactor({phase}-{plan}): clean up [feature]`

**Result:** Each TDD plan produces 2 commits (optional 3rd for refactor).
</execution_flow>

<test_quality>
## Good Tests vs Bad Tests

**Test behavior, not implementation:**
- Good: "returns formatted date string"
- Bad: "calls formatDate helper with correct params"
- Tests should survive refactors

**One concept per test:**
- Good: Separate tests for valid input, empty input, malformed input
- Bad: Single test checking all edge cases with multiple assertions

**Descriptive names:**
- Good: "should reject empty email", "returns null for invalid ID"
- Bad: "test1", "handles error", "works correctly"

**No implementation details:**
- Good: Test public API, observable behavior
- Bad: Mock internals, test private methods, assert on internal state
</test_quality>

<framework_setup>
## Test Framework Setup (If None Exists)

When executing a TDD plan but no test framework is configured, set it up as part of the RED phase:

**1. Detect project type:**
```bash
detect_project_type() {
  [ -f "package.json" ] && echo "node" && return
  [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] && echo "python" && return
  [ -f "go.mod" ] && echo "go" && return
  [ -f "Cargo.toml" ] && echo "rust" && return
  [ -f "build.gradle" ] || [ -f "pom.xml" ] && echo "java" && return
  ls *.csproj *.sln >/dev/null 2>&1 && echo "dotnet" && return
  echo "unknown"
}
```

**2. Install minimal framework:**

| Project | Framework | Install | Built-in |
|---------|-----------|---------|----------|
| Node.js | Vitest | `npm install -D vitest` | No |
| Node.js | Jest | `npm install -D jest` | No |
| Python | pytest | `pip install pytest` | No |
| Go | testing | — | Yes |
| Rust | cargo test | — | Yes |
| Java (Gradle) | JUnit 5 | Add to `build.gradle` | Usually |
| Java (Maven) | JUnit 5 | Add to `pom.xml` | Usually |
| .NET | xUnit/NUnit | `dotnet add package xunit` | No |

**3. Create config if needed:**

| Project | Config File | Purpose |
|---------|-------------|---------|
| Node.js (Jest) | `jest.config.js` | ts-jest preset, test paths |
| Node.js (Vitest) | `vitest.config.ts` | test globals |
| Python | `pytest.ini` or `pyproject.toml` | test discovery |
| Go | — | Built-in, no config |
| Rust | — | Built-in, no config |
| Java | `build.gradle` or `pom.xml` | JUnit dependency |
| .NET | `*.csproj` | Test SDK reference |

**4. Verify setup:**
```bash
# Run empty test suite - should pass with 0 tests
case "$PROJECT_TYPE" in
  node)   npm test ;;
  python) pytest ;;
  go)     go test ./... ;;
  rust)   cargo test ;;
  java)   ./gradlew test || mvn test ;;
  dotnet) dotnet test ;;
esac
```

**5. Create first test file:**

| Project | Test File Pattern | Location |
|---------|-------------------|----------|
| Node.js | `*.test.ts`, `*.spec.js` | Next to source or `__tests__/` |
| Python | `test_*.py`, `*_test.py` | `tests/` directory |
| Go | `*_test.go` | Same package as source |
| Rust | `#[test]` in source or `tests/*.rs` | `tests/` directory |
| Java | `*Test.java` | `src/test/java/` |
| .NET | `*Tests.cs` | Separate test project |

Framework setup is a one-time cost included in the first TDD plan's RED phase.
</framework_setup>

<error_handling>
## Error Handling

**Test doesn't fail in RED phase:**
- Feature may already exist - investigate
- Test may be wrong (not testing what you think)
- Fix before proceeding

**Test doesn't pass in GREEN phase:**
- Debug implementation
- Keep iterating until green

**Unrelated tests break:**
- Stop and investigate
- May indicate coupling issue
- Fix before proceeding
</error_handling>

<commit_pattern>
## Commit Pattern for TDD Plans

TDD plans produce 2 atomic commits (optional 3rd for refactor):

```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected
- Tests empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322
- Returns boolean for validity
- Handles edge cases (empty, null)

# Optional — only if obvious cleanup exists:
refactor(08-02): extract regex to constant

- Moved pattern to EMAIL_REGEX constant
- No behavior changes
- Tests still pass
```

**Comparison with standard plans:**
- Standard plans: 1 commit per task, 2-4 commits per plan
- TDD plans: 2 commits for single feature (optional 3rd)

Both follow same format: `{type}({phase}-{plan}): {description}`

**Benefits:**
- Each commit independently revertable
- Git bisect works at commit level
- Clear history showing TDD discipline
- Consistent with overall commit strategy
</commit_pattern>

<context_budget>
## Context Budget

TDD plans target **~45% context usage** (lower than standard plans' ~50%).

The RED→GREEN back-and-forth with file reads, test runs, and output analysis is heavier than linear task execution. Single feature focus ensures full quality throughout the cycle.
</context_budget>
