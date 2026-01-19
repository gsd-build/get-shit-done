# Phase 1: Constitution Foundation - Research

**Researched:** 2026-01-19
**Domain:** Configuration file parsing, merging, versioning, and two-stage development workflow
**Confidence:** HIGH

## Summary

Constitution Foundation requires parsing YAML frontmatter + markdown files, merging global and project-level configurations with override precedence, implementing semantic versioning for migration safety, and following a two-stage development workflow where changes are tested in installed GSD first before updating repo source.

The standard Node.js ecosystem provides battle-tested libraries: **gray-matter** for frontmatter parsing (used by Gatsby, Netlify, Astro, HashiCorp), **semver** for version comparison (npm's own library), **deepmerge** for configuration merging, and **Jest** or **Vitest** for TDD. The two-stage workflow uses direct file modification in `~/.claude/get-shit-done/` for testing, then copying validated changes back to repo source.

Critical architectural decisions: (1) Two-stage workflow prevents breaking installed GSD—test changes in real environment first. (2) Synchronous file loading appropriate during initialization but never in runtime. (3) Array merging strategy must be explicit—replacement vs concatenation has major implications. (4) TDD mandatory for loader/parser code—test file parsing errors, version conflicts, merge edge cases. (5) Cross-platform path handling requires Node's `path` module, not tilde expansion.

**Primary recommendation:** Use gray-matter + semver + deepmerge with Jest/Vitest for TDD. Develop in `~/.claude/get-shit-done/`, validate with real GSD workflows, then copy to repo source. Synchronous loading during init, explicit array replacement, path.join for all paths.

## Standard Stack

The established libraries/tools for configuration parsing and two-stage development:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | latest | YAML frontmatter parsing | Battle-tested, used by Gatsby, Netlify, Astro, HashiCorp. Better edge case handling |
| semver | latest | Semantic version comparison | Official npm semver parser. Comprehensive API (gt, lt, satisfies, compare) |
| deepmerge | 4.3.1+ | Deep object merging | Dedicated utility, 12,473+ projects. Predictable array handling |
| Jest | 29+ | Test framework | Industry standard. Excellent mocking for fs operations. TDD-friendly |
| mock-fs | latest | Mock file system for tests | In-memory fs for testing file loaders without real files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | latest | Alternative test framework | If using Vite. 30-70% faster than Jest in CI, 10-20x faster watch mode |
| lodash.merge | latest | Alternative deep merge | If lodash already in dependencies. Note: mutates first object |
| marked | latest | Alternative markdown parser | Need stability over features. Industry standard 10+ years |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | front-matter | Less feature-rich, no stringify support |
| semver | compare-versions | Lighter but less comprehensive. Missing satisfies() for range checking |
| deepmerge | Custom recursive merge | Reinventing wheel. Edge cases (circular refs, prototypes) hard |
| Jest | Mocha + Chai | More setup. Jest has built-in mocking, assertions, coverage |
| mock-fs | memfs + unionfs | More complex setup. mock-fs simpler for config loader testing |

**Installation:**
```bash
npm install gray-matter semver deepmerge
npm install --save-dev jest mock-fs
```

## Two-Stage Development Workflow

### Workflow Overview

**Problem:** GSD is installed globally at `~/.claude/get-shit-done/`. Changes to repo source don't affect running system until reinstalled. Testing requires constant reinstallation, slowing development.

**Solution:** Two-stage workflow develops directly in installed location, validates with real GSD commands, then copies validated code to repo source.

### Stage 1: Develop in Installed Location

**Where:** `~/.claude/get-shit-done/` (installed GSD)

**What to modify:**
- Template files: `~/.claude/get-shit-done/templates/CONSTITUTION.md`
- Workflow files: `~/.claude/get-shit-done/workflows/*.md` (if loading constitution)
- Test files: Create test suite in installed location or run from repo against installed files

**Development flow:**
```bash
# 1. Modify installed files directly
vim ~/.claude/get-shit-done/templates/CONSTITUTION.md

# 2. Test with real GSD workflows
cd ~/test-project
/gsd:new-project  # Triggers constitution loading

# 3. Run tests against installed files
npm test -- --testPathPattern=constitution

# 4. Iterate until working
```

**Why this works:**
- Changes immediately active in GSD workflows
- No reinstallation needed between edits
- Test with actual GSD execution environment
- Catch integration issues early

### Stage 2: Copy to Repo Source

**After validation in installed GSD:**

```bash
# 1. Identify changed files
ls -lt ~/.claude/get-shit-done/templates/ | head

# 2. Copy to repo source
cp ~/.claude/get-shit-done/templates/CONSTITUTION.md \
   ~/Projects/get-shit-done-mm/get-shit-done/templates/

# 3. Verify repo structure matches
diff ~/.claude/get-shit-done/templates/CONSTITUTION.md \
     ~/Projects/get-shit-done-mm/get-shit-done/templates/CONSTITUTION.md

# 4. Commit to repo
cd ~/Projects/get-shit-done-mm
git add get-shit-done/templates/CONSTITUTION.md
git commit -m "feat(constitution): add global constitution template"
```

**Path mappings:**

| Installed Location | Repo Source |
|-------------------|-------------|
| `~/.claude/get-shit-done/templates/*.md` | `get-shit-done/templates/*.md` |
| `~/.claude/get-shit-done/workflows/*.md` | `get-shit-done/workflows/*.md` |
| `~/.claude/get-shit-done/references/*.md` | `get-shit-done/references/*.md` |
| `~/.claude/commands/gsd/*.md` | `commands/gsd/*.md` |
| `~/.claude/agents/*.md` | `agents/*.md` |

### Stage 2.5: Loader Code Development

**For JavaScript loader modules** (constitution-loader.js, etc.):

**Option A: Develop in repo, test against installed**
```bash
# 1. Create loader in repo source
vim ~/Projects/get-shit-done-mm/src/constitution/loader.js

# 2. Test against installed constitution files
# Test file imports loader from repo, reads files from ~/.claude/
npm test -- loader.test.js

# 3. After tests pass, no copy needed (already in repo)
```

**Option B: Create standalone loader for installed GSD**
```bash
# 1. If GSD needs runtime loader, create in installed location
vim ~/.claude/get-shit-done/lib/constitution-loader.js

# 2. Test with real workflows
# 3. Copy to repo source after validation
cp ~/.claude/get-shit-done/lib/*.js \
   ~/Projects/get-shit-done-mm/lib/
```

**Recommendation:** Use Option A. Keep loader code in repo, test against installed files. Simpler workflow, better version control.

### Integration Testing Strategy

**Test constitution loading in installed GSD:**

```javascript
// constitution-loader.test.js (in repo)
const fs = require('fs');
const path = require('path');
const os = require('os');
const ConstitutionLoader = require('../src/constitution/loader');

describe('Constitution Loader - Installed Files', () => {
  test('loads global constitution from installed location', () => {
    const loader = new ConstitutionLoader();
    const globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'CONSTITUTION.md');

    // Verify file exists in installed location
    expect(fs.existsSync(globalPath)).toBe(true);

    // Load and parse
    const constitution = loader.load();
    expect(constitution.version).toBeDefined();
    expect(constitution.rules['NON-NEGOTIABLE']).toBeDefined();
  });

  test('handles missing project constitution gracefully', () => {
    // Test when only global exists (common case)
    const loader = new ConstitutionLoader();
    const constitution = loader.load();

    // Should load global successfully
    expect(constitution).toBeDefined();
  });
});
```

### TDD Workflow in Two-Stage Model

**1. Write test (in repo)**
```javascript
// tests/constitution/parser.test.js
test('parses NON-NEGOTIABLE rules from markdown', () => {
  const content = `---
version: "1.0.0"
---

# NON-NEGOTIABLE

### TDD-01: Test before implementation

Write tests before code.
`;
  const parsed = parseConstitution(content);
  expect(parsed.rules['NON-NEGOTIABLE']).toHaveLength(1);
  expect(parsed.rules['NON-NEGOTIABLE'][0].id).toBe('TDD-01');
});
```

**2. Run test (fails)**
```bash
npm test -- parser.test.js
# FAIL: parseConstitution is not defined
```

**3. Write implementation (in repo)**
```javascript
// src/constitution/parser.js
function parseConstitution(content) {
  // Implementation
}
```

**4. Run test (passes)**
```bash
npm test -- parser.test.js
# PASS
```

**5. Test in installed GSD (integration)**
```bash
# Create test constitution in installed location
cat > ~/.claude/get-shit-done/CONSTITUTION.md << 'EOF'
---
version: "1.0.0"
---

# NON-NEGOTIABLE

### TDD-01: Test before implementation
EOF

# Test with real GSD workflow
cd ~/test-project
# Trigger constitution loading via GSD command
```

**6. Copy validated code to repo (if needed)**
```bash
# If implementation files were created in installed location, copy
# Otherwise, already in repo from step 3
```

### Common Pitfalls with Two-Stage Workflow

**Pitfall 1: Forgetting to copy back to repo**
- Symptom: Works in installed GSD but broken after reinstall
- Prevention: Checklist in PLAN.md - "After validation, copy to repo source"
- Fix: Compare installed vs repo files, copy missing changes

**Pitfall 2: Editing repo source instead of installed**
- Symptom: Changes have no effect when testing GSD workflows
- Prevention: Double-check file paths before editing
- Fix: Copy repo changes to installed location, or start over

**Pitfall 3: Path confusion (installed vs repo)**
- Symptom: Tests fail because looking in wrong location
- Prevention: Use `os.homedir() + '/.claude/get-shit-done/'` for installed paths
- Fix: Update test paths to match actual installed location

**Pitfall 4: Modifying files installed by npm**
- Symptom: Changes lost on reinstall, never persisted
- Prevention: Only edit files you'll copy back. Track what you modify.
- Fix: Maintain list of modified files, verify all copied to repo

## Architecture Patterns

### Recommended Project Structure
```
# Repo source
get-shit-done-mm/
├── src/
│   └── constitution/
│       ├── loader.js           # Loads and merges global + project files
│       ├── parser.js           # Parses YAML frontmatter + markdown sections
│       ├── versioning.js       # Checks version compatibility
│       └── merger.js           # Merges global + project rules
├── tests/
│   └── constitution/
│       ├── loader.test.js
│       ├── parser.test.js
│       ├── versioning.test.js
│       └── merger.test.js
├── get-shit-done/
│   └── templates/
│       └── CONSTITUTION.md     # Global template (copied to installed)
└── .planning/
    └── templates/
        └── CONSTITUTION.md     # Project template

# Installed location (after npm install)
~/.claude/get-shit-done/
├── templates/
│   └── CONSTITUTION.md         # Global template (active)
├── workflows/
│   └── execute-plan.md         # May load constitution
└── lib/                         # If runtime loader needed
    └── constitution-loader.js
```

### Pattern 1: Configuration Loading (Initialization Only)

**What:** Load global and project constitution files during app initialization using synchronous fs methods.

**When to use:** Application startup, before serving requests or executing main logic. Never use sync methods in runtime operations.

**Example:**
```javascript
// Source: Node.js best practices + fs module docs
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadConstitutionFiles() {
  // Cross-platform home directory
  const homeDir = os.homedir();
  const globalPath = path.join(homeDir, '.claude', 'get-shit-done', 'CONSTITUTION.md');
  const projectPath = path.join(process.cwd(), '.planning', 'CONSTITUTION.md');

  // Synchronous loading is OK during initialization
  const globalExists = fs.existsSync(globalPath);
  const projectExists = fs.existsSync(projectPath);

  const globalContent = globalExists ? fs.readFileSync(globalPath, 'utf8') : null;
  const projectContent = projectExists ? fs.readFileSync(projectPath, 'utf8') : null;

  return { global: globalContent, project: projectContent };
}
```

### Pattern 2: Frontmatter + Markdown Parsing

**What:** Parse YAML frontmatter and extract markdown sections with rule IDs.

**When to use:** After loading file content, before merging configurations.

**Example:**
```javascript
// Source: gray-matter documentation
const matter = require('gray-matter');

function parseConstitution(content) {
  // Parse frontmatter
  const { data: frontmatter, content: markdown } = matter(content);

  // Extract sections by severity
  const rules = {};
  for (const severity of ['NON-NEGOTIABLE', 'ERROR', 'WARNING']) {
    rules[severity] = extractRulesFromSection(markdown, severity);
  }

  return {
    version: frontmatter.version,
    lastUpdated: frontmatter.lastUpdated,
    rules
  };
}

function extractRulesFromSection(markdown, severity) {
  // Find section starting with # SEVERITY
  const sectionPattern = new RegExp(`# ${severity}([\\s\\S]*?)(?=# [A-Z]|$)`);
  const match = markdown.match(sectionPattern);

  if (!match) return [];

  const sectionContent = match[1];

  // Extract rules with format: ### RULE-ID: Description
  const rulePattern = /^### ([A-Z]+-\d+):\s*(.+)$/gm;
  const rules = [];
  let ruleMatch;

  while ((ruleMatch = rulePattern.exec(sectionContent)) !== null) {
    rules.push({
      id: ruleMatch[1],
      description: ruleMatch[2],
      severity
    });
  }

  return rules;
}
```

### Pattern 3: Semantic Version Checking

**What:** Verify constitution version compatibility before merging.

**When to use:** After parsing both constitutions, before merge operation.

**Example:**
```javascript
// Source: semver documentation
const semver = require('semver');

function checkVersionCompatibility(globalVersion, projectVersion) {
  // Ensure project version is compatible with global
  if (!semver.valid(globalVersion) || !semver.valid(projectVersion)) {
    throw new Error('Invalid semver format in constitution version');
  }

  // Breaking change detection (major version mismatch)
  const globalMajor = semver.major(globalVersion);
  const projectMajor = semver.major(projectVersion);

  if (projectMajor < globalMajor) {
    throw new Error(
      `Constitution version mismatch: project (${projectVersion}) behind global (${globalVersion}). Migration required.`
    );
  }

  return {
    compatible: true,
    globalVersion,
    projectVersion,
    needsMigration: projectMajor !== globalMajor
  };
}
```

### Pattern 4: Configuration Merging with Array Replacement

**What:** Merge global and project constitutions with project override precedence.

**When to use:** After version checking, to produce final merged configuration.

**Example:**
```javascript
// Source: deepmerge documentation
const deepmerge = require('deepmerge');

function mergeConstitutions(globalConfig, projectConfig) {
  // Array replacement strategy: project arrays completely replace global arrays
  const arrayMergeStrategy = (target, source) => source;

  const merged = deepmerge(globalConfig, projectConfig, {
    arrayMerge: arrayMergeStrategy,
    // Ensure we create new object, not mutate global
    clone: true
  });

  // Validation: ensure rule IDs are unique
  const allRuleIds = new Set();
  for (const severity of ['NON-NEGOTIABLE', 'ERROR', 'WARNING']) {
    for (const rule of merged.rules[severity]) {
      if (allRuleIds.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      allRuleIds.add(rule.id);
    }
  }

  return merged;
}
```

### Pattern 5: TDD for File Loading with mock-fs

**What:** Test file loading logic with in-memory filesystem to avoid creating real files.

**When to use:** Testing constitution loader, especially error cases (missing files, parse errors).

**Example:**
```javascript
// Source: mock-fs documentation + Jest best practices
const mock = require('mock-fs');
const ConstitutionLoader = require('../src/constitution/loader');

describe('ConstitutionLoader', () => {
  afterEach(() => {
    mock.restore(); // Restore real filesystem
  });

  test('loads global constitution when it exists', () => {
    // Mock filesystem
    mock({
      '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---

# NON-NEGOTIABLE

### TDD-01: Test before implementation
`
    });

    const loader = new ConstitutionLoader();
    const constitution = loader.load();

    expect(constitution.version).toBe('1.0.0');
    expect(constitution.rules['NON-NEGOTIABLE']).toHaveLength(1);
  });

  test('throws error when version is invalid semver', () => {
    mock({
      '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "not-a-version"
---
# NON-NEGOTIABLE
`
    });

    const loader = new ConstitutionLoader();
    expect(() => loader.load()).toThrow('Invalid semver format');
  });

  test('merges global and project constitutions', () => {
    mock({
      '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Test before implementation
`,
      '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---
# ERROR

### CUSTOM-01: Project-specific rule
`
    });

    const loader = new ConstitutionLoader();
    const constitution = loader.load();

    // Should have rules from both
    expect(constitution.rules['NON-NEGOTIABLE']).toHaveLength(1);
    expect(constitution.rules['ERROR']).toHaveLength(1);
  });
});
```

### Pattern 6: Cross-Platform Path Resolution

**What:** Handle file paths safely across Windows, macOS, and Linux.

**When to use:** Everywhere paths are constructed or resolved.

**Example:**
```javascript
// Source: Node.js path module documentation
const path = require('path');
const os = require('os');

function resolveConstitutionPaths() {
  // NEVER use string concatenation or backslashes
  // BAD: homeDir + '/.claude/get-shit-done/CONSTITUTION.md'
  // BAD: homeDir + '\\.claude\\get-shit-done\\CONSTITUTION.md'

  // GOOD: Always use path.join
  const homeDir = os.homedir(); // Works on all platforms
  const globalPath = path.join(homeDir, '.claude', 'get-shit-done', 'CONSTITUTION.md');

  // If supporting tilde syntax, expand manually
  function expandTilde(filepath) {
    if (filepath.startsWith('~/')) {
      return path.join(os.homedir(), filepath.slice(2));
    }
    return filepath;
  }

  return { globalPath, expandTilde };
}
```

### Anti-Patterns to Avoid

- **Async file loading during initialization:** Adds complexity with no benefit. Sync is appropriate for startup config loading.
- **String-based path concatenation:** `homeDir + '/.claude/...'` breaks on Windows. Always use `path.join()`.
- **Array concatenation for rule merging:** Concatenating rules from global + project creates duplicates and unclear precedence. Use replacement.
- **Manual version comparison:** `globalVer > projectVer` string comparison fails for versions like "1.9.0" vs "1.10.0". Use semver.
- **Mutating global config:** `_.merge(globalConfig, projectConfig)` mutates first argument. Always create new object: `_.merge({}, global, project)`.
- **Testing without mock-fs:** Creating real files in tests causes cleanup issues, permission problems, platform-specific paths.
- **Editing repo source during testing:** Changes won't affect installed GSD. Edit installed files, validate, then copy back.

## TDD Patterns for Constitution Foundation

### TDD Test Structure

**Mandatory test categories for constitution code:**

1. **Parsing tests** - YAML frontmatter, markdown sections, rule extraction
2. **Validation tests** - Version format, required fields, rule ID uniqueness
3. **Merging tests** - Global + project merge, array replacement, override precedence
4. **Error handling tests** - Missing files, parse errors, version conflicts
5. **Edge case tests** - Empty files, malformed YAML, duplicate rule IDs

### TDD Workflow for Constitution Loader

**Red-Green-Refactor cycle:**

```javascript
// TEST (Red): Write failing test first
describe('ConstitutionLoader', () => {
  test('throws error when global constitution missing and no project constitution exists', () => {
    mock({}); // Empty filesystem

    const loader = new ConstitutionLoader();
    expect(() => loader.load()).toThrow('No constitution files found');
  });
});

// Run: npm test -- constitution-loader.test.js
// Result: FAIL - load() not implemented

// CODE (Green): Minimum code to pass
class ConstitutionLoader {
  load() {
    const globalExists = fs.existsSync(this.globalPath);
    const projectExists = fs.existsSync(this.projectPath);

    if (!globalExists && !projectExists) {
      throw new Error('No constitution files found (global or project)');
    }

    // Minimal implementation
  }
}

// Run: npm test
// Result: PASS

// REFACTOR: Improve code quality
class ConstitutionLoader {
  constructor() {
    this.globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'CONSTITUTION.md');
    this.projectPath = path.join(process.cwd(), '.planning', 'CONSTITUTION.md');
  }

  load() {
    this._validateConstitutionsExist();
    // Continue implementation
  }

  _validateConstitutionsExist() {
    const globalExists = fs.existsSync(this.globalPath);
    const projectExists = fs.existsSync(this.projectPath);

    if (!globalExists && !projectExists) {
      throw new Error('No constitution files found (global or project)');
    }
  }
}

// Run: npm test
// Result: PASS (refactor doesn't break tests)
```

### Test Coverage Requirements

**Minimum coverage for constitution code:**

- **Statements:** 100% (critical infrastructure, must test all paths)
- **Branches:** 100% (error handling must be tested)
- **Functions:** 100% (all public and private methods)
- **Lines:** 100% (configuration loading is deterministic)

**Run coverage:**
```bash
npm test -- --coverage --coverageDirectory=coverage
# View: open coverage/lcov-report/index.html
```

### TDD Test Examples for Common Scenarios

**Scenario 1: YAML Type Coercion**
```javascript
test('handles version as string, not number', () => {
  mock({
    '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0"
---
# NON-NEGOTIABLE
`
  });

  const loader = new ConstitutionLoader();
  const constitution = loader.load();

  // Should be string "1.0", not number 1.0
  expect(typeof constitution.version).toBe('string');
  expect(constitution.version).toBe('1.0');
});
```

**Scenario 2: Duplicate Rule IDs**
```javascript
test('throws error on duplicate rule IDs after merge', () => {
  mock({
    '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Test before implementation
`,
    '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Different description
`
  });

  const loader = new ConstitutionLoader();
  // Should throw because TDD-01 appears in both
  expect(() => loader.load()).toThrow('Duplicate rule ID: TDD-01');
});
```

**Scenario 3: Version Compatibility**
```javascript
test('allows project version equal to global version', () => {
  mock({
    '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---`,
    '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---`
  });

  const loader = new ConstitutionLoader();
  expect(() => loader.load()).not.toThrow();
});

test('throws error when major versions differ', () => {
  mock({
    '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "2.0.0"
---`,
    '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---`
  });

  const loader = new ConstitutionLoader();
  expect(() => loader.load()).toThrow(/version mismatch/i);
});
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom YAML parser | gray-matter | Edge cases: indentation errors, type coercion (yes/no → boolean), special characters, BOM handling, nested structures. 70% of YAML issues are indentation-related. |
| Semantic version comparison | String comparison or regex | semver | Version comparison fails with string logic ("1.9.0" > "1.10.0" is false). Semver handles pre-release tags, build metadata, range satisfaction. |
| Deep object merging | Recursive merge function | deepmerge or lodash.merge | Circular references, prototype pollution, array handling, symbol properties, getter/setter preservation. Easy to get wrong. |
| Markdown section extraction | Regex-based heading search | Custom parser with AST | Nested headings, escaped characters, code blocks with fake headings, HTML in markdown, heading level hierarchy. |
| Tilde path expansion | String replace `~/` with `homeDir` | Manual os.homedir() | Edge case: `~username/path` (other user's home), `~+` (cwd), platform-specific behavior. Don't use expand-tilde package (unmaintained, vulnerable). |
| Cross-platform paths | String concatenation with `/` or `\\` | path.join() and os.homedir() | Windows uses `\`, Unix uses `/`. `path.join()` handles platform differences automatically. |
| Mock filesystem for tests | Creating real temp files | mock-fs | Cleanup issues, permission problems, slower tests, platform-specific paths. mock-fs provides in-memory fs. |
| Test framework setup | Custom test runner | Jest or Vitest | Jest has built-in mocking, coverage, watch mode. Vitest 30-70% faster. Both handle async, parallel execution. |

**Key insight:** Configuration parsing is deceptively complex. YAML indentation, version comparison semantics, deep merge edge cases, and filesystem mocking cause subtle bugs that only manifest in production. Use battle-tested libraries. TDD catches these edge cases before they reach users.

## Common Pitfalls

### Pitfall 1: YAML Indentation Errors

**What goes wrong:** 70% of YAML parsing issues stem from indentation. Mixing tabs and spaces, inconsistent spacing (2 vs 4 spaces), or single misaligned character breaks parsing.

**Why it happens:** YAML uses whitespace for structure (unlike JSON's braces). Invisible characters (tabs, non-breaking spaces, zero-width characters) look identical to spaces but break parsers.

**How to avoid:**
- Enforce 2-space indentation consistently (configure editor)
- Never allow tabs in YAML files (set editor to convert tabs → spaces)
- Use YAML linting (yamllint or IDE plugins)
- gray-matter provides better error messages than raw YAML parsers
- TDD: Test with malformed YAML to ensure error messages are clear

**Warning signs:**
- Parse error mentioning "mapping" or "sequence" without obvious syntax error
- Error on line with correct-looking indentation (check for tabs with hex editor)
- Works in one editor but fails in another (tab vs space mixing)

### Pitfall 2: YAML Type Coercion Surprises

**What goes wrong:** YAML auto-converts values like `yes`, `no`, `on`, `off`, `true`, `false` to booleans. A version field like `version: 1.0` becomes number `1.0`, losing trailing zero.

**Why it happens:** YAML spec defines implicit type conversions for readability. Parsers treat unquoted values as typed data, not strings.

**How to avoid:**
- Always quote string values in frontmatter: `version: "1.0.0"`
- Quote values with special meaning: `"yes"`, `"no"`, `"true"`, `"false"`
- Use explicit types: `!!str yes` forces string interpretation
- TDD: Test that version is string type, not number

**Warning signs:**
- Version `1.0` parsed as `1` (number)
- Boolean where string expected
- Unexpected type errors when accessing frontmatter fields

### Pitfall 3: Array Merge Strategy Mismatch

**What goes wrong:** Default deep merge concatenates arrays, causing global rules + project rules to duplicate. Alternatively, index-based merging replaces array[0] with array[0], creating Frankenstein configuration.

**Why it happens:** No universal "correct" array merge strategy. Concatenation makes sense for some use cases (dependency arrays), replacement for others (rule definitions).

**How to avoid:**
- Explicitly define array merge strategy: `arrayMerge: (target, source) => source` for replacement
- Document the strategy in code comments
- Validate merged result (check for duplicate rule IDs)
- TDD: Test merge produces expected rule count, no duplicates

**Warning signs:**
- Duplicate rules in merged config
- Rules from global appearing when project explicitly overrode them
- Unexpected rule count after merge

### Pitfall 4: Testing Without mock-fs

**What goes wrong:** Tests create real files in filesystem. Cleanup fails, leaving orphaned files. Permission errors on CI. Platform-specific paths break cross-platform tests.

**Why it happens:** Developers think "just create a temp file" is simpler than learning mock-fs. Cleanup in afterEach() fails when tests throw errors.

**How to avoid:**
- Use mock-fs for all constitution loader tests
- Never use fs.writeFileSync() in tests
- mock.restore() in afterEach() to clean up
- Test isolation: each test has independent filesystem

**Warning signs:**
- Test directories accumulating in /tmp or project root
- Tests failing on CI but passing locally (permission differences)
- Tests interfering with each other (shared file state)

### Pitfall 5: Editing Repo Source During Two-Stage Development

**What goes wrong:** Developer edits `get-shit-done-mm/get-shit-done/templates/CONSTITUTION.md` expecting changes to affect GSD workflows. Changes have no effect because GSD loads from `~/.claude/get-shit-done/`.

**Why it happens:** Confusion about which files are "active". GSD uses installed files, not repo source.

**How to avoid:**
- Always edit installed files first: `~/.claude/get-shit-done/templates/CONSTITUTION.md`
- Test with GSD workflows to verify changes work
- Copy validated files to repo source as final step
- Maintain checklist: "Modified installed files? Copied to repo?"

**Warning signs:**
- Changes to repo files have no effect when testing GSD
- Forgetting which version (installed vs repo) has latest changes
- Reinstalling GSD and losing changes

### Pitfall 6: Synchronous IO in Runtime

**What goes wrong:** Using `fs.readFileSync()` in request handlers or runtime operations blocks Node's event loop, destroying concurrency and application performance.

**Why it happens:** Sync methods are simpler to write (no callbacks/promises). Developers copy initialization code into runtime without realizing the impact.

**How to avoid:**
- Only use sync fs methods during application startup (before server starts listening)
- Use async methods (`fs.promises.readFile`) for all runtime operations
- Establish clear boundary: initialization = sync OK, runtime = async only
- Constitution loading: initialization only, cache result

**Warning signs:**
- Application becomes unresponsive under load
- Request latency spikes
- Single slow file read blocks all requests

### Pitfall 7: Platform-Specific Path Assumptions

**What goes wrong:** Hardcoded `/` separators or `~` expansion fails on Windows. Assuming home directory structure breaks across platforms.

**Why it happens:** Developers test on one platform (usually macOS/Linux) and assume paths work universally.

**How to avoid:**
- Always use `path.join()`, never string concatenation
- Get home directory from `os.homedir()`, not `process.env.HOME`
- Test on multiple platforms or use path.resolve for absolute paths
- TDD: Run tests on Windows, macOS, Linux (via CI)

**Warning signs:**
- "ENOENT: no such file or directory" errors on Windows
- Paths like `/Users/...` hardcoded in code
- Tilde `~` appearing in resolved paths (Node doesn't expand it)

### Pitfall 8: Version String Comparison

**What goes wrong:** String comparison `"1.9.0" > "1.10.0"` evaluates to `true` because string comparison is lexicographic, not semantic. Causes version checks to fail catastrophically.

**Why it happens:** Assuming version numbers follow normal comparison rules. JavaScript string comparison goes character-by-character.

**How to avoid:**
- Always use semver library for version comparison
- Validate version format with `semver.valid()` before storing
- Use `semver.gt()`, `semver.lt()`, `semver.satisfies()` for comparisons
- TDD: Test version comparison edge cases (1.9 vs 1.10, pre-release versions)

**Warning signs:**
- Version 1.10 treated as older than 1.9
- Pre-release versions (1.0.0-alpha) causing unexpected behavior
- Range checking (`^1.0.0`) not working

### Pitfall 9: Duplicate Rule IDs Across Global + Project

**What goes wrong:** Same rule ID defined in both global and project constitutions. Merge produces duplicate or overwrites rule unintentionally.

**Why it happens:** No automatic uniqueness constraint. Rule IDs chosen independently for global and project.

**How to avoid:**
- Validate uniqueness after merge: collect all rule IDs into Set, detect duplicates
- Establish naming convention: global uses standard IDs, project uses PRJ-XXX prefix
- Document override behavior: project rule ID matching global rule ID intentionally replaces it
- TDD: Test duplicate detection throws error

**Warning signs:**
- Same rule appearing twice in merged config
- Rule content from wrong source (global instead of expected project override)
- Verification checking rules that shouldn't exist

## Code Examples

Verified patterns from official sources:

### Complete Constitution Loader with TDD

```javascript
// Source: Synthesized from gray-matter, semver, deepmerge documentation
const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');
const semver = require('semver');
const deepmerge = require('deepmerge');

class ConstitutionLoader {
  constructor() {
    this.globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'CONSTITUTION.md');
    this.projectPath = path.join(process.cwd(), '.planning', 'CONSTITUTION.md');
  }

  load() {
    // Sync loading during initialization is appropriate
    const globalContent = this._readFile(this.globalPath);
    const projectContent = this._readFile(this.projectPath);

    if (!globalContent && !projectContent) {
      throw new Error('No constitution files found (global or project)');
    }

    const globalConfig = globalContent ? this._parse(globalContent) : null;
    const projectConfig = projectContent ? this._parse(projectContent) : null;

    // Version compatibility check
    if (globalConfig && projectConfig) {
      this._checkVersions(globalConfig.version, projectConfig.version);
    }

    // Merge with project override precedence
    const merged = this._merge(globalConfig, projectConfig);

    // Validate uniqueness
    this._validateRuleIds(merged);

    return merged;
  }

  _readFile(filepath) {
    if (!fs.existsSync(filepath)) {
      return null;
    }
    return fs.readFileSync(filepath, 'utf8');
  }

  _parse(content) {
    const { data: frontmatter, content: markdown } = matter(content);

    // Validate frontmatter
    if (!frontmatter.version) {
      throw new Error('Constitution missing required field: version');
    }
    if (!semver.valid(frontmatter.version)) {
      throw new Error(`Invalid semver format: ${frontmatter.version}`);
    }

    // Extract sections
    const rules = {};
    const severities = ['NON-NEGOTIABLE', 'ERROR', 'WARNING'];

    for (const severity of severities) {
      rules[severity] = this._extractRules(markdown, severity);
    }

    return {
      version: frontmatter.version,
      lastUpdated: frontmatter.lastUpdated,
      rules
    };
  }

  _extractRules(markdown, severity) {
    // Find section starting with # SEVERITY
    const sectionPattern = new RegExp(`# ${severity}([\\s\\S]*?)(?=# [A-Z]|$)`);
    const match = markdown.match(sectionPattern);

    if (!match) return [];

    const sectionContent = match[1];

    // Extract rules with format: ### RULE-ID: Description
    const rulePattern = /^### ([A-Z]+-\d+):\s*(.+)$/gm;
    const rules = [];
    let ruleMatch;

    while ((ruleMatch = rulePattern.exec(sectionContent)) !== null) {
      rules.push({
        id: ruleMatch[1],
        description: ruleMatch[2],
        severity
      });
    }

    return rules;
  }

  _checkVersions(globalVersion, projectVersion) {
    // Major version must match (breaking changes)
    if (semver.major(globalVersion) !== semver.major(projectVersion)) {
      throw new Error(
        `Constitution major version mismatch: global ${globalVersion}, project ${projectVersion}`
      );
    }
  }

  _merge(globalConfig, projectConfig) {
    if (!globalConfig) return projectConfig;
    if (!projectConfig) return globalConfig;

    // Array replacement strategy: project completely replaces global
    return deepmerge(globalConfig, projectConfig, {
      arrayMerge: (target, source) => source,
      clone: true
    });
  }

  _validateRuleIds(config) {
    const seen = new Set();

    for (const severity of ['NON-NEGOTIABLE', 'ERROR', 'WARNING']) {
      for (const rule of config.rules[severity]) {
        if (seen.has(rule.id)) {
          throw new Error(`Duplicate rule ID: ${rule.id}`);
        }
        seen.add(rule.id);
      }
    }
  }
}

module.exports = ConstitutionLoader;
```

### TDD Test Suite for Constitution Loader

```javascript
// tests/constitution/loader.test.js
const mock = require('mock-fs');
const ConstitutionLoader = require('../../src/constitution/loader');

describe('ConstitutionLoader', () => {
  afterEach(() => {
    mock.restore();
  });

  describe('File Loading', () => {
    test('loads global constitution when it exists', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---

# NON-NEGOTIABLE

### TDD-01: Test before implementation
`
      });

      const loader = new ConstitutionLoader();
      const constitution = loader.load();

      expect(constitution.version).toBe('1.0.0');
      expect(constitution.rules['NON-NEGOTIABLE']).toHaveLength(1);
      expect(constitution.rules['NON-NEGOTIABLE'][0].id).toBe('TDD-01');
    });

    test('throws error when no constitution files exist', () => {
      mock({});

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).toThrow('No constitution files found');
    });
  });

  describe('Parsing', () => {
    test('throws error when version is missing', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
lastUpdated: "2026-01-19"
---
# NON-NEGOTIABLE
`
      });

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).toThrow('Constitution missing required field: version');
    });

    test('throws error when version is invalid semver', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "not-a-version"
---
# NON-NEGOTIABLE
`
      });

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).toThrow('Invalid semver format');
    });

    test('handles version as string, not number', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0"
---
# NON-NEGOTIABLE
`
      });

      const loader = new ConstitutionLoader();
      const constitution = loader.load();

      expect(typeof constitution.version).toBe('string');
      expect(constitution.version).toBe('1.0');
    });
  });

  describe('Version Compatibility', () => {
    test('allows same major version', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---`,
        '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---`
      });

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).not.toThrow();
    });

    test('throws error when major versions differ', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "2.0.0"
---`,
        '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---`
      });

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).toThrow(/version mismatch/i);
    });
  });

  describe('Merging', () => {
    test('merges global and project rules', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Test before implementation
`,
        '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---
# ERROR

### CUSTOM-01: Project-specific rule
`
      });

      const loader = new ConstitutionLoader();
      const constitution = loader.load();

      expect(constitution.rules['NON-NEGOTIABLE']).toHaveLength(1);
      expect(constitution.rules['ERROR']).toHaveLength(1);
    });

    test('throws error on duplicate rule IDs', () => {
      mock({
        '/Users/testuser/.claude/get-shit-done/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Test before implementation
`,
        '/Users/testuser/project/.planning/CONSTITUTION.md': `---
version: "1.0.0"
---
# NON-NEGOTIABLE

### TDD-01: Different description
`
      });

      const loader = new ConstitutionLoader();
      expect(() => loader.load()).toThrow('Duplicate rule ID: TDD-01');
    });
  });
});
```

## Security Rule Documentation Patterns

[Previous security patterns SEC-01 through SEC-07 content remains unchanged...]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON configuration | YAML frontmatter + markdown | 2015-2020 | More readable, supports documentation with rules. Common in static site generators. |
| Manual version comparison | semver library | Established (npm standard) | Reliable semantic versioning. Handles pre-release, build metadata, range satisfaction. |
| Regex-based markdown parsing | AST-based parsers (marked, custom) | 2018-2023 | Safer parsing, handles edge cases. Regex fragile for nested structures. |
| Async-only fs operations | Sync during init, async at runtime | Best practice | Simpler initialization code, better performance at runtime. |
| Real files in tests | mock-fs for in-memory fs | 2019+ | Faster tests, no cleanup issues, platform-independent, isolated test state. |
| Mocha + Chai | Jest or Vitest | Jest: 2016+, Vitest: 2022+ | Built-in mocking, coverage, watch. Vitest 30-70% faster in CI. |

**Deprecated/outdated:**
- **expand-tilde package:** Low maintenance (last update 2017), has security vulnerabilities. Better: manual expansion with `os.homedir()`.
- **js-yaml-front-matter:** Superseded by gray-matter. Less active maintenance.
- **Regex-based frontmatter extraction:** Fragile, breaks on edge cases. Use gray-matter instead.
- **Creating real files in tests:** Use mock-fs instead. Avoids cleanup issues, permission problems, platform-specific paths.

## Open Questions

Things that couldn't be fully resolved:

1. **Runtime vs initialization loading for constitution**
   - What we know: Sync loading OK during initialization, async required at runtime
   - What's unclear: Should constitution be loaded once at init and cached, or reloaded on demand?
   - Recommendation: Load once at init, cache in memory. Constitution rarely changes during execution. Reload only if file mtime changes.

2. **Rule override semantics when IDs match**
   - What we know: Project should override global for same rule ID
   - What's unclear: Should it be explicit (project declares "override: RULE-ID") or implicit (matching ID = override)?
   - Recommendation: Start with implicit (simpler), add explicit if needed. Document behavior clearly. TDD: test both global-only and override scenarios.

3. **Migration strategy for constitution version changes**
   - What we know: Major version change = breaking change, should prevent merge
   - What's unclear: Should system auto-migrate, prompt user, or fail fast?
   - Recommendation: Fail fast with clear error message in Phase 1. Migration tooling in later phase if needed.

4. **Test execution during two-stage workflow**
   - What we know: Tests should run against loader code, validate with real GSD workflows
   - What's unclear: Should tests run in repo (npm test) or in installed location?
   - Recommendation: Run tests in repo (normal TDD workflow), then validate manually with installed GSD. Tests use mock-fs, don't depend on installed files.

## Sources

### Primary (HIGH confidence)
- [gray-matter GitHub repository](https://github.com/jonschlinkert/gray-matter) - Frontmatter parser API and usage
- [semver GitHub repository](https://github.com/npm/node-semver) - Version comparison functions
- Node.js official documentation (path module, os module, fs module) - Platform-independent file operations
- [Jest documentation](https://jestjs.io/docs/getting-started) - Test framework setup and mocking
- [mock-fs GitHub repository](https://github.com/tschaub/mock-fs) - In-memory filesystem for testing
- [Vitest documentation](https://vitest.dev/guide/) - Alternative test framework with Vite integration
- [npm link usage](https://medium.com/@ruben.alapont/npm-link-developing-and-testing-local-npm-packages-b50a32b50c4a) - Local package development workflow
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-testing-best-practices) - TDD patterns and coverage strategies

### Secondary (MEDIUM confidence)
- [YAML indentation pitfalls](https://flipperfile.com/developer-guides/yaml/why-yaml-indentation-breaks-easily/) - 70% of YAML errors are indentation-related
- [Cross-platform Node.js paths](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/file_paths.md) - Path handling best practices
- [Configuration merging patterns - webpack-merge](https://survivejs.com/blog/webpack-merge-interview/) - Array concatenation vs replacement strategies
- [Node.js sync vs async best practices](https://medium.com/@shubham3480/node-part-v-0f626ead588d) - When sync methods are appropriate
- [TDD with Node.js and Jest](https://www.pedroalonso.net/blog/tdd-nodejs-jest/) - Red-Green-Refactor workflow
- [mock-fs best practices](https://www.emgoto.com/nodejs-mock-fs/) - Testing file operations with in-memory fs
- [Vitest vs Jest 2026](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) - Performance comparisons

### Tertiary (LOW confidence - WebSearch only)
- Various npm comparison sites (npm-compare.com) - Library popularity metrics
- Medium articles on deep merging - General patterns, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - gray-matter, semver, deepmerge, Jest/Vitest are industry standards with official documentation verified
- Architecture: HIGH - Patterns synthesized from official docs and established Node.js best practices
- Two-stage workflow: MEDIUM - Based on npm link patterns and local development best practices, validated with GSD install structure
- TDD patterns: HIGH - Derived from official Jest/Vitest documentation and Node.js testing best practices
- Pitfalls: MEDIUM to HIGH - YAML indentation (70% statistic verified), version comparison (semver docs), path handling (Node.js docs), mock-fs usage (official docs)
- Security patterns: HIGH - All examples derived from OWASP official cheat sheets (previous research)

**Research date:** 2026-01-19
**Valid until:** ~30 days (stable ecosystem, unlikely to change rapidly)

**Key decisions for planner:**
1. Use two-stage workflow: develop in `~/.claude/get-shit-done/`, validate with GSD workflows, copy to repo source
2. TDD mandatory: Write tests first for all loader/parser/merger code using mock-fs
3. Use synchronous file loading during initialization (appropriate for config loading)
4. Implement array replacement strategy for rule merging (not concatenation)
5. Validate version compatibility before merge (fail fast on major version mismatch)
6. Use `path.join()` and `os.homedir()` for all path operations (cross-platform)
7. Validate rule ID uniqueness after merge (prevent duplicates)
8. 100% test coverage required for constitution code (critical infrastructure)
9. Security rule documentation must include good/bad code examples from OWASP patterns
10. Each security rule needs rationale explaining attack vectors and impacts
