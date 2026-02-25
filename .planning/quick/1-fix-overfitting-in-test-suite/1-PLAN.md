---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/frontmatter.test.cjs
  - tests/core.test.cjs
  - tests/config.test.cjs
  - tests/commands.test.cjs
  - tests/state.test.cjs
autonomous: true
requirements: []

must_haves:
  truths:
    - "All 448+ tests still pass after changes"
    - "npm run test:coverage still passes (all modules above 70%)"
    - "No test asserts on exact default config values or exact schema shapes"
    - "Model profile tests verify override logic, not lookup table contents"
    - "Date assertions handle midnight boundary safely"
    - "URL parameter test verifies values, not raw encoding format"
  artifacts:
    - path: "tests/frontmatter.test.cjs"
      provides: "Schema tests without deepStrictEqual on required-field arrays or schema key list"
    - path: "tests/core.test.cjs"
      provides: "Model profile tests: structural validation + override tests only (no per-profile lookup matrix)"
    - path: "tests/config.test.cjs"
      provides: "Default value tests use type/existence checks; exact value only when testing explicit override"
    - path: "tests/commands.test.cjs"
      provides: "URL test parses URL and checks decoded parameter values"
    - path: "tests/state.test.cjs"
      provides: "Date assertion handles midnight boundary"
  key_links:
    - from: "tests/core.test.cjs"
      to: "MODEL_PROFILES"
      via: "structural validation"
      pattern: "Object\\.keys.*MODEL_PROFILES"
---

<objective>
Remove test overfitting across 5 test files. These tests currently assert on implementation internals (exact schema arrays, lookup table values, hardcoded defaults, raw URL encoding) rather than observable behavior. After fixes, tests verify logic and contracts — overrides, types, existence, decoded parameter values — without being fragile to internal refactors.

Purpose: Tests should catch regressions, not prevent refactoring. Overfit tests break on every internal change without adding safety.
Output: 5 updated test files with all existing tests still passing.
</objective>

<execution_context>
@/Users/annon/.claude/get-shit-done/workflows/execute-plan.md
@/Users/annon/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix HIGH severity overfitting — frontmatter, core, commands, state</name>
  <files>
    tests/frontmatter.test.cjs
    tests/core.test.cjs
    tests/commands.test.cjs
    tests/state.test.cjs
  </files>
  <action>
**tests/frontmatter.test.cjs — Delete schema shape tests (lines 357-382):**

Delete the entire `describe('FRONTMATTER_SCHEMAS', ...)` block (lines 356-382). This includes:
- `test('plan schema has correct required fields', ...)` — deepStrictEqual on FRONTMATTER_SCHEMAS.plan.required
- `test('summary schema has correct required fields', ...)` — deepStrictEqual on FRONTMATTER_SCHEMAS.summary.required
- `test('verification schema has correct required fields', ...)` — deepStrictEqual on FRONTMATTER_SCHEMAS.verification.required
- `test('all schema names are present', ...)` — deepStrictEqual on Object.keys(FRONTMATTER_SCHEMAS)

These assert on the lookup table shape itself. The CLI validate tests in frontmatter-cli.test.cjs already exercise schema behavior end-to-end.

**tests/core.test.cjs — Collapse model profile matrix (lines 145-209):**

Replace the three `describe('quality profile', ...)`, `describe('balanced profile', ...)`, and `describe('budget profile', ...)` blocks (lines 145-209) with a single structural validation test:

```js
describe('model profile structural validation', () => {
  test('all known agents resolve to a valid string for each profile', () => {
    const knownAgents = ['gsd-planner', 'gsd-executor', 'gsd-phase-researcher', 'gsd-codebase-mapper'];
    const profiles = ['quality', 'balanced', 'budget'];
    const validValues = ['inherit', 'sonnet', 'haiku', 'opus'];

    for (const profile of profiles) {
      writeConfig({ model_profile: profile });
      for (const agent of knownAgents) {
        const result = resolveModelInternal(tmpDir, agent);
        assert.ok(
          validValues.includes(result),
          `profile=${profile} agent=${agent} returned unexpected value: ${result}`
        );
      }
    }
  });
});
```

Keep the existing `describe('override precedence', ...)` (lines 211-235) and `describe('edge cases', ...)` (lines 237-249) blocks unchanged — those test real logic.

**tests/commands.test.cjs — Fix URL parameter test (lines 1140-1157):**

Replace the raw string `.includes()` assertions with URL-parsed assertions. The current test uses `capturedUrl.includes('q=node.js+testing')` which is fragile to URL encoding differences (e.g., `%2B` vs `+`, `%20` vs `+`).

Replace lines 1154-1156 with:

```js
const parsed = new URL(capturedUrl);
assert.strictEqual(parsed.searchParams.get('q'), 'node.js testing', 'query param should decode to original string');
assert.strictEqual(parsed.searchParams.get('count'), '5', 'count param should be 5');
assert.strictEqual(parsed.searchParams.get('freshness'), 'pd', 'freshness param should be pd');
```

Remove the three `assert.ok(capturedUrl.includes(...))` lines.

**tests/state.test.cjs — Fix midnight date fragility (line 644):**

Replace line 644-645:
```js
const today = new Date().toISOString().split('T')[0];
assert.ok(updated.includes(`**Last Activity:** ${today}`), 'Last Activity should be updated to today');
```

With a midnight-safe assertion:
```js
const before = new Date().toISOString().split('T')[0];
// (command already ran above)
const after = new Date().toISOString().split('T')[0];
assert.ok(
  updated.includes(`**Last Activity:** ${before}`) || updated.includes(`**Last Activity:** ${after}`),
  `Last Activity should be today (${before}) or next day if midnight boundary (${after})`
);
```

Note: `before` must be captured before the `runGsdTools` call. Looking at the test structure (line 629-645), the command runs at line 632. Capture `before` at line 631 (before the runGsdTools call), then capture `after` at line 643 (after reading the file). The assertion replaces line 644-645.
  </action>
  <verify>
    <automated>cd /Users/annon/projects/get-shit-done && node --test tests/frontmatter.test.cjs tests/core.test.cjs tests/commands.test.cjs tests/state.test.cjs 2>&1 | tail -20</automated>
    <manual>Check that the FRONTMATTER_SCHEMAS describe block is gone from frontmatter.test.cjs and the three profile-matrix describe blocks are replaced with one structural test in core.test.cjs</manual>
  </verify>
  <done>
    - frontmatter.test.cjs: FRONTMATTER_SCHEMAS describe block deleted (4 tests removed)
    - core.test.cjs: 12 profile-matrix tests replaced by 1 structural validation test; override/edge-case tests unchanged
    - commands.test.cjs: URL assertions use URL.searchParams.get() not raw string includes
    - state.test.cjs: date assertion uses before/after window instead of single snapshot
    - All 4 test files pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix config.test.cjs default-value assertions and verify full suite</name>
  <files>tests/config.test.cjs</files>
  <action>
**Lines 138 and 176-177 — exact default value assertions:**

Line 138 is inside a `~/.gsd/defaults.json` test that writes `{ model_profile: 'quality', commit_docs: false }` as the user's defaults. The assertion `assert.strictEqual(config.branching_strategy, 'none', ...)` tests a hardcoded default that was NOT set via the user defaults file — it's testing the built-in fallback. Change it to a type check:

```js
// Line 138: was assert.strictEqual(config.branching_strategy, 'none', ...)
assert.strictEqual(typeof config.branching_strategy, 'string', 'branching_strategy should be a string');
```

Lines 176-177 are inside a nested workflow merge test. The assertions:
```js
assert.strictEqual(config.workflow.plan_check, true, 'plan_check should be preserved');
assert.strictEqual(config.workflow.verifier, true, 'verifier should be preserved');
```

These assert on exact boolean default values for keys that were NOT set by the test — just that they were "preserved" (not overwritten). A type check is more appropriate:

```js
// Lines 176-177: check type/existence, not exact value
assert.strictEqual(typeof config.workflow.plan_check, 'boolean', 'plan_check should be a boolean');
assert.strictEqual(typeof config.workflow.verifier, 'boolean', 'verifier should be a boolean');
```

**Lines 79-188 — home directory isolation (MEDIUM severity):**

The tests at lines 79-188 (`detects Brave Search from file-based key`, `merges user defaults from defaults.json`, `merges nested workflow keys from defaults.json`) already have proper save/restore try/finally logic and skip guards (line 85-87). Add a comment above each test documenting the isolation pattern:

```js
// NOTE: This test touches ~/.gsd/ on the real filesystem. It uses save/restore
// try/finally and skips if the file already exists to avoid corrupting user config.
```

No structural changes needed for MEDIUM — the isolation is already correct.

After editing config.test.cjs, run the full test suite to confirm all modules pass:

```bash
cd /Users/annon/projects/get-shit-done && npm run test:coverage 2>&1 | tail -40
```

Verify output shows all coverage thresholds met (no module below 70%).
  </action>
  <verify>
    <automated>cd /Users/annon/projects/get-shit-done && npm run test:coverage 2>&1 | tail -40</automated>
    <manual>Confirm "All files" coverage row shows >= 70% and no test failures are reported</manual>
  </verify>
  <done>
    - config.test.cjs line 138: branching_strategy check is typeof string, not strictEqual 'none'
    - config.test.cjs lines 176-177: plan_check and verifier checks are typeof boolean, not strictEqual true
    - Isolation comments added to the three ~/.gsd/ tests
    - npm run test:coverage passes with all modules >= 70%
    - Total test count same or higher than pre-change (removed 4 frontmatter tests, replaced 12 profile tests with 1, net ~-15 tests)
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

```bash
cd /Users/annon/projects/get-shit-done && npm run test:coverage 2>&1 | tail -50
```

Expected: All modules above 70%, no test failures. The test count will be approximately 15 fewer than the starting 448 (4 deleted schema tests + 11 net reduction in profile matrix).

Spot checks:
- `grep -n "deepStrictEqual" tests/frontmatter.test.cjs` — should return 0 results in the FRONTMATTER_SCHEMAS section (other deepStrictEqual uses in the file are fine)
- `grep -n "searchParams" tests/commands.test.cjs` — should show the URL parsing approach
- `grep -n "before\|after" tests/state.test.cjs | grep -i "date\|today"` — should show the two-snapshot approach
</verification>

<success_criteria>
- npm run test:coverage exits 0
- All coverage thresholds met (>= 70% per module)
- No test asserts on exact default config values (branching_strategy, plan_check, verifier)
- No deepStrictEqual on FRONTMATTER_SCHEMAS.*.required arrays or schema key list
- No model profile matrix tests (per-profile per-agent lookup assertions)
- URL test uses URL.searchParams.get() not raw string includes
- Date assertion uses before/after window
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-overfitting-in-test-suite/1-SUMMARY.md`
</output>
