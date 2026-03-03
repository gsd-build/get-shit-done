# Phase 36: Foundation Fix - Research

**Researched:** 2026-03-03
**Domain:** CI pipeline integrity / test path hygiene
**Confidence:** HIGH

## Summary

Phase 36 fixes a structural defect in `tests/integration/wiring-validation.test.js` where test assertions target `.claude/agents/` (the install target, gitignored but partially force-tracked) instead of `agents/` (the npm source directory). This caused 5 consecutive CI failures throughout v1.16 (signal: `sig-2026-03-02-ci-failures-ignored-throughout-v116`), all bypassed via admin push. A partial fix was applied in commit `61f3f02` (the `subagent_type` check now tries `agents/` first), but many other test sections still use `.claude/agents/` and `.claude/agents/kb-templates/` as primary assertion paths. These tests currently pass in CI only because some `.claude/` files are force-tracked in git, creating a fragile dependency on a non-standard git pattern.

The phase has three deliverables: (1) fix all remaining `.claude/` primary assertion paths to use `agents/` (npm source), (2) create a meta-test that prevents recurrence by failing if any test file uses `.claude/` as a primary assertion path, and (3) ensure CI is green on main. The scope is narrow and entirely within the test file itself -- no production code changes are needed.

**Primary recommendation:** Systematically change all test assertions in `wiring-validation.test.js` to read from `agents/` (npm source) instead of `.claude/agents/` (install target), update the `refToRepoPath` function to map agent references to npm source paths, and add a meta-test that greps all test files for `.claude/` primary assertion patterns.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test runner | Already in use; all project tests use vitest |
| node:fs/promises | native | File system assertions | Already used in wiring-validation.test.js |
| node:path | native | Path resolution | Already used in wiring-validation.test.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs (globSync) | native | File pattern matching | Already imported in test file |

No new dependencies needed. This phase modifies existing test files only.

## Architecture Patterns

### Dual-Directory Model (Critical Context)

This project has two copies of agent specs:

```
agents/                    # npm source -- what gets packaged and shipped
  gsd-executor.md
  gsd-planner.md
  kb-templates/
    signal.md
    spike.md
    lesson.md
    ...

.claude/agents/            # install target -- populated by bin/install.js
  gsd-executor.md          # (force-tracked subset)
  kb-create-dirs.sh        # (shell scripts: .claude only, no npm source)
  kb-rebuild-index.sh      # (shell scripts: .claude only, no npm source)
  kb-templates/
    signal.md              # (force-tracked)
    ...
```

**Key facts verified from codebase inspection:**

1. `.claude/` is in `.gitignore` (line 9)
2. 28 `.claude/` files are **force-tracked** (`git add -f`) and DO exist in CI checkout
3. 6 newer agents exist in `agents/` but NOT in `.claude/agents/` force-tracked set: `gsd-artifact-sensor`, `gsd-git-sensor`, `gsd-log-sensor`, `gsd-plan-checker`, `gsd-research-synthesizer`, `gsd-signal-synthesizer`
4. 2 shell scripts exist ONLY in `.claude/agents/`, not in `agents/`: `kb-create-dirs.sh`, `kb-rebuild-index.sh`
5. `kb-templates/` exists in BOTH `agents/kb-templates/` and `.claude/agents/kb-templates/` (force-tracked)

### Pattern 1: npm-Source-First Assertion

**What:** Tests should assert against `agents/` (npm source), not `.claude/agents/` (install target)
**When to use:** Every test that validates agent file existence, content, or wiring
**Why:** npm source is the canonical truth; `.claude/` is a derived copy that may be stale, incomplete, or absent

```javascript
// CORRECT: Check npm source directory
const allAgents = await readMdFiles('agents')
const kbTemplate = path.join(REPO_ROOT, 'agents/kb-templates/signal.md')

// WRONG: Check install target
const allAgents = await readMdFiles('.claude/agents')
const kbTemplate = path.join(REPO_ROOT, '.claude/agents/kb-templates/signal.md')
```

### Pattern 2: Fallback for Shell Scripts

**What:** Shell scripts (`kb-create-dirs.sh`, `kb-rebuild-index.sh`) exist only in `.claude/agents/`, not in `agents/`
**When to use:** When a test must reference these scripts
**Why:** These are fork-specific runtime artifacts, not shipped via npm

```javascript
// Shell scripts are a legitimate exception -- they only exist in .claude/agents/
// The meta-test should allowlist these specific paths
const SHELL_SCRIPT_EXCEPTIONS = [
  '.claude/agents/kb-create-dirs.sh',
  '.claude/agents/kb-rebuild-index.sh',
]
```

### Pattern 3: Path Mapping Fix

**What:** The `refToRepoPath` function currently maps `~/.claude/agents/` to `.claude/agents/` (install target)
**When to use:** When resolving @-references in agent files
**Why:** Should map to `agents/` (npm source) for CI compatibility

```javascript
// CURRENT (line 48-49, broken):
if (ref.startsWith('~/.claude/agents/')) {
  return ref.replace('~/.claude/agents/', '.claude/agents/')
}

// FIXED:
if (ref.startsWith('~/.claude/agents/')) {
  return ref.replace('~/.claude/agents/', 'agents/')
}
```

### Anti-Patterns to Avoid

- **Changing `refToRepoPath` without updating downstream expectations:** The @-reference tests in the "agents resolve" section use this function. Changing the mapping changes what paths are checked.
- **Removing all `.claude/` references indiscriminately:** Some references are legitimate (e.g., the `refToRepoPath` input patterns that match `.claude/` prefixes, path mapping tests, documentation about the dual-directory model). The meta-test must distinguish primary assertion paths from mapping logic.
- **Testing both directories for everything:** The subagent_type fix used a "try npm source, fall back to .claude/" pattern. While pragmatic, this hides the root issue. For wiring validation, tests should assert against the canonical source (npm).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Meta-test for path recurrence | Complex AST parsing of test files | Simple grep/regex scan of test file contents | The assertion patterns (`.claude/agents/` in `readMdFiles()` calls, `path.join()` calls, `pathExists()` calls) are distinctive enough for regex matching |

**Key insight:** A meta-test does not need to understand JavaScript semantics. It needs to detect patterns like `readMdFiles('.claude/agents')`, `path.join(REPO_ROOT, '.claude/agents/...)`, and `pathExists('.claude/agents/...')` in test source files. A grep-based approach is sufficient and more maintainable than AST analysis.

## Common Pitfalls

### Pitfall 1: Breaking the @-reference resolution chain
**What goes wrong:** Changing `refToRepoPath` to map `~/.claude/agents/` to `agents/` but not updating the agent @-reference test (lines 143-166) that reads from `.claude/agents` to read from `agents/` instead.
**Why it happens:** The test reads agent files from `.claude/agents`, extracts @-references, maps them via `refToRepoPath`, and checks existence. Both the read source AND the mapping must change together.
**How to avoid:** Change `readMdFiles('.claude/agents')` to `readMdFiles('agents')` AND change `refToRepoPath` mapping in the same edit.
**Warning signs:** Test passes locally (where both dirs exist) but fails in CI (where only npm source + force-tracked subset exist).

### Pitfall 2: Shell script exceptions in the meta-test
**What goes wrong:** Meta-test flags legitimate `.claude/agents/` references to shell scripts that only exist there.
**Why it happens:** `kb-create-dirs.sh` and `kb-rebuild-index.sh` are fork-specific runtime scripts without npm-source equivalents.
**How to avoid:** The meta-test must have an explicit allowlist for known exceptions (shell scripts, path mapping logic, documentation references).
**Warning signs:** Meta-test fails on legitimate code.

### Pitfall 3: False positives in the meta-test
**What goes wrong:** Meta-test catches `.claude/` references in comments, string literals describing the dual-directory model, or the `refToRepoPath` function's input matching logic.
**Why it happens:** Naive grep for `.claude/` matches too broadly.
**How to avoid:** The meta-test should focus on specific assertion patterns:
  - `readMdFiles('.claude/...` -- reading from install target for assertions
  - `path.join(REPO_ROOT, '.claude/...` -- constructing paths to install target
  - `pathExists('.claude/...` -- asserting existence at install target
  It should NOT flag:
  - Comments explaining the dual-directory model
  - `refToRepoPath` input pattern matching (the function handles @-references)
  - Fallback paths (where npm source is checked first)
  - `install.test.js` which legitimately tests the installer's output at `.claude/`
  - `multi-runtime.test.js` and `cross-runtime-kb.test.js` which test path transformation
  - `smoke/run-smoke.sh` which runs in an installed environment
**Warning signs:** Lots of false positives requiring excessive exceptions.

### Pitfall 4: KB template path changes
**What goes wrong:** Changing KB template assertions from `.claude/agents/kb-templates/` to `agents/kb-templates/` but the templates in `agents/kb-templates/` have different content than `.claude/agents/kb-templates/`.
**Why it happens:** The npm source and install target could have drifted.
**How to avoid:** Verify `agents/kb-templates/` content matches `.claude/agents/kb-templates/` before switching assertion target. (Based on codebase inspection, both directories exist with the same template files.)

### Pitfall 5: Reflect/spike command fallback paths
**What goes wrong:** The "reflect commands reference correct workflows" test (lines 283-315) has fallback logic: tries `commands/gsd/reflect.md` first, then `.claude/commands/gsd/reflect.md`. This fallback is intentional because these commands are fork additions that may only exist in `.claude/`.
**Why it happens:** Some commands originate from the fork and are force-tracked in `.claude/commands/gsd/`.
**How to avoid:** Check if `commands/gsd/reflect.md` and `commands/gsd/spike.md` exist in npm source. If yes, remove the fallback. If not, this fallback is a legitimate pattern and should be excluded from the meta-test.

## Code Examples

### Example 1: Fixing the agents @-reference test (lines 143-166)

```javascript
// BEFORE: Reads from install target
describe('@-references in agents resolve', () => {
  it('all @-references in agents/gsd-*.md resolve', async () => {
    const allAgents = await readMdFiles('agents')  // Changed from '.claude/agents'
    const gsdAgents = allAgents.filter(f => f.name.startsWith('gsd-'))
    // ... rest stays the same
  })
})
```

### Example 2: Fixing the subagent_type source directories (lines 170-177)

```javascript
// BEFORE: Scans install target for subagent_type declarations
const dirs = [
  'commands/gsd',
  'get-shit-done/workflows',
  'agents',              // Changed from '.claude/agents'
  'get-shit-done/templates',
]
```

### Example 3: Fixing KB template tests (lines 219-272)

```javascript
// BEFORE: Reads KB templates from install target
it('signal template has severity and signal_type', async () => {
  const content = await fs.readFile(
    path.join(REPO_ROOT, 'agents/kb-templates/signal.md'),  // Changed from '.claude/agents/kb-templates/signal.md'
    'utf8'
  )
  expect(content).toContain('severity:')
  expect(content).toContain('signal_type:')
})
```

### Example 4: Fixing fork-specific file existence test (line 404)

```javascript
// BEFORE: Checks install target
it('KB signal template exists', async () => {
  const exists = await pathExists('agents/kb-templates/signal.md')  // Changed from '.claude/agents/kb-templates/signal.md'
  expect(exists).toBe(true)
})
```

### Example 5: Meta-test for path recurrence prevention

```javascript
describe('test hygiene', () => {
  it('no test file uses .claude/ as a primary assertion path', async () => {
    const testDir = path.join(REPO_ROOT, 'tests')
    const testFiles = globSync('**/*.test.js', { cwd: testDir })

    // Patterns that indicate .claude/ is used as a primary assertion path
    // (not as fallback, not in path-mapping logic, not in installer tests)
    const PRIMARY_ASSERTION_PATTERNS = [
      /readMdFiles\(\s*['"]\.claude\//,              // Reading from install target
      /path\.join\(REPO_ROOT,\s*['"]\.claude\//,     // Constructing install target paths
      /pathExists\(\s*['"]\.claude\//,                // Asserting existence at install target
    ]

    // Files that legitimately test .claude/ behavior
    const EXEMPT_FILES = [
      'unit/install.test.js',        // Tests installer output
      'integration/multi-runtime.test.js',   // Tests path transformation
      'integration/cross-runtime-kb.test.js', // Tests KB path transformation
    ]

    const violations = []
    for (const file of testFiles) {
      if (EXEMPT_FILES.some(exempt => file.endsWith(exempt))) continue
      const content = await fs.readFile(path.join(testDir, file), 'utf8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        for (const pattern of PRIMARY_ASSERTION_PATTERNS) {
          if (pattern.test(lines[i])) {
            violations.push({
              file,
              line: i + 1,
              text: lines[i].trim(),
            })
          }
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map(v => `  ${v.file}:${v.line}: ${v.text}`)
        .join('\n')
      expect.fail(
        `Test files must assert against agents/ (npm source), not .claude/agents/ (install target).\n` +
        `Violations:\n${details}\n\n` +
        `If this is a legitimate exception, add the test file to EXEMPT_FILES.`
      )
    }
  })
})
```

## Specific Changes Inventory

Complete list of `.claude/` references in `wiring-validation.test.js` that need changing:

| Line(s) | Current | Change To | Notes |
|---------|---------|-----------|-------|
| 48-49 | `refToRepoPath` maps `~/.claude/agents/` to `.claude/agents/` | Map to `agents/` | Core path resolution fix |
| 144-145 | `readMdFiles('.claude/agents')` | `readMdFiles('agents')` | Agent @-reference test source |
| 170 | Test description mentions `.claude/agents/{value}.md` | Update description | Cosmetic |
| 175 | `'.claude/agents'` in dirs array | `'agents'` | Subagent_type source scan |
| 222, 231, 240 | `'.claude/agents/kb-templates/...'` | `'agents/kb-templates/...'` | KB frontmatter tests |
| 251, 259, 267 | `'.claude/agents/kb-templates/...'` | `'agents/kb-templates/...'` | KB body section tests |
| 293, 309 | Fallback to `.claude/commands/gsd/` | Verify if npm source exists; simplify if so | Command reference tests |
| 404 | `pathExists('.claude/agents/kb-templates/signal.md')` | `pathExists('agents/kb-templates/signal.md')` | Fork-specific existence test |

Other test files with `.claude/` references (NOT in scope for path fixes -- they are legitimate):

| File | Why Legitimate |
|------|----------------|
| `tests/unit/install.test.js` | Tests the installer, which writes to `.claude/` |
| `tests/integration/multi-runtime.test.js` | Tests path transformation across runtimes |
| `tests/integration/cross-runtime-kb.test.js` | Tests KB path handling across runtimes |
| `tests/integration/kb-infrastructure.test.js` | References `.claude/agents/kb-*.sh` (shell scripts that only exist there) |
| `tests/smoke/run-smoke.sh` | Runs in installed environment |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tests check `.claude/agents/` (install target) | Tests should check `agents/` (npm source) | Phase 36 (this phase) | Prevents CI failures when new agents are added to npm source but not force-tracked |
| No recurrence prevention | Meta-test catches future `.claude/` assertion paths in test files | Phase 36 (this phase) | Structural prevention of path recurrence |

## Open Questions

### Resolved
- **Q: Do KB templates exist in `agents/kb-templates/`?** Yes -- verified via `ls agents/kb-templates/` showing `lesson.md`, `signal.md`, `spike-decision.md`, `spike-design.md`, `spike.md`.
- **Q: Why did CI pass after the partial fix?** Because many `.claude/` files are force-tracked in git and exist in CI checkout. The fix in commit `61f3f02` addressed the specific failure (6 newer agents not force-tracked), but the underlying anti-pattern remains.
- **Q: Should the force-tracked `.claude/` files be untracked?** Out of scope for this phase. The CLAUDE.md documents the dual-directory architecture and the installer's role. Force-tracking is a separate concern.
- **Q: Do `commands/gsd/reflect.md` and `commands/gsd/spike.md` exist in npm source?** Yes -- they exist in `commands/gsd/`, so the fallback to `.claude/commands/gsd/` in the test is unnecessary.

### Genuine Gaps

| Question | Criticality | Recommendation |
|----------|-------------|----------------|
| Should `kb-infrastructure.test.js` references to `.claude/agents/kb-*.sh` be changed? | Medium | These shell scripts only exist in `.claude/agents/`. Either copy them to `agents/` or exempt `kb-infrastructure.test.js` in the meta-test. Recommend exemption since scripts are runtime-only. |

### Still Open
- None -- all questions resolved through codebase investigation.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `tests/integration/wiring-validation.test.js` (424 lines, full read)
- Direct codebase inspection of `.github/workflows/ci.yml` (CI configuration)
- `git ls-files .claude/` output confirming 28 force-tracked files
- `git diff 61f3f02^..61f3f02` confirming scope of prior partial fix
- `git show 668cdd6 --stat` confirming separate manifest test fix
- `.gitignore` confirming `.claude/` is gitignored (line 9)
- `agents/` and `agents/kb-templates/` directory listings confirming npm source content

### Secondary (MEDIUM confidence)
- `sig-2026-03-02-ci-failures-ignored-throughout-v116` signal providing historical context
- `gh run list` confirming current CI status (green after fixes)

## Knowledge Applied

| Entry | Type | Summary | Applied To |
|-------|------|---------|------------|
| sig-2026-03-02-ci-failures-ignored-throughout-v116 | signal | 5 consecutive CI failures caused by wiring test checking .claude/ (gitignored); root cause is test asserting against install target instead of npm source | Summary, Architecture Patterns |
| les-2026-02-28-plans-must-verify-system-behavior-not-assume | lesson | Plans that reference file paths in dual-directory architecture must verify paths exist before proceeding | Common Pitfalls (Pitfall 1, 4) |
| les-2026-03-02-runtime-behavior-requires-runtime-verification | lesson | Distinguish between spec-verified and runtime-verified; relevant context for why static test path assertions matter | Architecture Patterns rationale |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, existing vitest + node:fs used throughout
- Architecture: HIGH - dual-directory model documented in CLAUDE.md, verified via codebase inspection, git ls-files confirms force-tracked files
- Pitfalls: HIGH - each pitfall identified through direct code analysis with line numbers
- Code examples: HIGH - all examples derived from actual test file content with specific line references

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- test infrastructure changes infrequently)
