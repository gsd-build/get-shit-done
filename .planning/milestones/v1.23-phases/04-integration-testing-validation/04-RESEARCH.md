# Phase 4: Integration Testing & Validation - Research

**Researched:** 2026-03-03
**Domain:** E2E integration testing of Copilot installer output
**Confidence:** HIGH

## Summary

Phase 4 adds end-to-end integration tests that run `node bin/install.js --copilot --local` in isolated `/tmp` directories, then verify every expected artifact exists with correct structure and content. This is purely additive testing—no changes to installer code. The existing test file `tests/copilot-install.test.cjs` has 81 unit-level tests across 975 lines covering individual functions (Phase 1-3 work). Phase 4 appends new E2E `describe` blocks that exercise the full CLI install/uninstall flows.

QUAL-02 (conflict detection for non-GSD files) is explicitly out of scope per user decision. The only requirement to address is QUAL-01: post-install verification that skills and agents exist in `.github/`.

**Primary recommendation:** Add E2E integration tests to `tests/copilot-install.test.cjs` using `execFileSync` to run the actual installer CLI in temp directories, then assert on file existence, structure, and SHA256 manifest integrity.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tests execute a full `install --copilot` in a `/tmp` directory and verify output
- Verify: skills exist with correct structure (gsd-*/SKILL.md), agents exist (gsd-*.agent.md), instructions file has markers, manifest includes all files, engine directory is complete
- Same verification approach as existing `verifyInstalled()` / `verifyFileInstalled()` — existence + structure checks
- Also verify SHA256 hashes via manifest to confirm content integrity (same as `writeManifest()` already does)
- Use the same SHA256 hash comparison that the manifest system already uses — no new comparison mechanisms
- No structural/normalized diffing, no byte-level diff against reference `.github/` — keep it simple
- No changes to installer console output (existing ✓/✗ checkmarks stay as-is)
- Tests are purely assertions in the test file, not runtime verification features
- All GSD skills present as `.github/skills/gsd-*/SKILL.md`
- All GSD agents present as `.github/agents/gsd-*.agent.md`
- `copilot-instructions.md` exists with `<!-- GSD Configuration -->` markers
- `gsd-file-manifest.json` exists with correct structure
- `get-shit-done/` engine directory populated (bin, references, templates, workflows)
- Uninstall removes all GSD artifacts cleanly

### Claude's Discretion
- Exact number and granularity of test cases
- Whether to test local-only or both local + global
- Helper function organization

### Deferred Ideas (OUT OF SCOPE)
- **QUAL-02 (conflict detection)**: Warning when non-GSD files exist in skills/agents dirs — doesn't exist for any runtime, would be new feature
- **Reference diff comparison**: Byte-level or structural diff against `.github/` reference implementation — out of scope, not currently done for any runtime
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Post-install verification confirms skills and agents exist in `.github/` | E2E test runs full install, verifies all 31 skills dirs + SKILL.md, all 11 agents as .agent.md, instructions with markers, manifest structure, engine directory completeness |
| QUAL-02 | Warning if `.github/skills/` or `.github/agents/` contain non-GSD files that might conflict | **OUT OF SCOPE** — user decision in CONTEXT.md. No conflict detection feature exists for any runtime. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | built-in (Node ≥16.7) | Test runner (describe/test/assert) | Already used in all 16 existing test suites |
| `node:assert` | built-in | Assertions (strictEqual, ok, deepStrictEqual) | Already used across all tests |
| `node:child_process` | built-in | execFileSync to run installer CLI | Already used in helpers.cjs and verify.test.cjs |
| `node:fs` | built-in | File existence/content verification | Already used everywhere |
| `node:crypto` | built-in | SHA256 hash verification | Already used in installer's `fileHash()` |
| `node:os` | built-in | `os.tmpdir()` for temp dirs | Already used in existing tests |

### Supporting
No additional libraries needed. Everything is built-in Node.js.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` | jest/mocha | Would add dependencies — project uses zero test deps, `node:test` is the established pattern |
| Manual SHA256 | Compare against manifest JSON | Manifest already has correct hashes — verify files match manifest |

**Installation:**
```bash
# No new dependencies needed — all node:* built-ins
```

## Architecture Patterns

### Test File Location
Tests go in the **existing file** `tests/copilot-install.test.cjs`, appended after the current 975 lines. This follows the project pattern where all Copilot tests live in one file.

### Recommended Test Structure
```
tests/copilot-install.test.cjs (existing file — append new sections)
├── [existing] getDirName, getGlobalDir, etc. (lines 1-975, 81 tests)
├── [NEW] E2E: Copilot full install verification
│   ├── skills verification (31 dirs, each with SKILL.md)
│   ├── agents verification (11 .agent.md files)
│   ├── instructions verification (markers, content)
│   ├── manifest verification (structure, SHA256 integrity)
│   ├── engine directory verification (bin, references, templates, workflows)
│   └── version/changelog verification
└── [NEW] E2E: Copilot uninstall verification
    ├── clean uninstall (all artifacts removed)
    └── selective uninstall (non-GSD content preserved)
```

### Pattern 1: E2E Install Test via CLI Execution
**What:** Run the actual `bin/install.js` binary via `execFileSync` in a temp directory, then inspect the output directory.
**When to use:** For all E2E tests — the installer must run as a real CLI process, NOT via `GSD_TEST_MODE` imports (which skip main logic).
**Why execFileSync not execSync:** `execFileSync` with array args avoids shell interpretation, consistent with `helpers.cjs` pattern.

```javascript
const { execFileSync } = require('child_process');
const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

// Run full install in temp dir
function runCopilotInstall(cwd) {
  return execFileSync(process.execPath, [INSTALL_PATH, '--copilot', '--local'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GSD_TEST_MODE: undefined }, // ensure NOT in test mode
  });
}
```

**Critical:** The child process must NOT have `GSD_TEST_MODE` set. The parent test file sets it at line 10, but `execFileSync` creates a new process. We must explicitly exclude it from the env to ensure the real CLI logic runs.

### Pattern 2: Temp Directory Lifecycle
**What:** Create temp dir in `beforeEach`, clean up in `afterEach`.
**When to use:** Every E2E test group.

```javascript
let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-e2e-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

### Pattern 3: SHA256 Manifest Verification
**What:** Read the generated manifest, then independently hash each listed file and compare.
**When to use:** Content integrity verification (QUAL-01).

```javascript
const crypto = require('crypto');

function verifyManifestIntegrity(configDir) {
  const manifestPath = path.join(configDir, 'gsd-file-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
    const fullPath = path.join(configDir, relPath);
    const content = fs.readFileSync(fullPath);
    const actualHash = crypto.createHash('sha256').update(content).digest('hex');
    assert.strictEqual(actualHash, expectedHash, `Hash mismatch for ${relPath}`);
  }
  return manifest;
}
```

### Anti-Patterns to Avoid
- **Don't use `GSD_TEST_MODE` exports for E2E tests:** The `install()` and `uninstall()` functions are NOT exported. E2E tests must run the CLI binary directly.
- **Don't hardcode file counts as magic numbers:** Use constants like `EXPECTED_SKILLS = 31` and `EXPECTED_AGENTS = 11` at the top with comments explaining source.
- **Don't test installer console output:** Per user decision, tests verify file system artifacts, not stdout messages.
- **Don't modify `process.cwd()`:** The installer uses `process.cwd()` for local installs. Use `execFileSync` with `cwd` option instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA256 hashing | Custom hash function | `crypto.createHash('sha256')` — same as installer's `fileHash()` | Exact same algorithm ensures consistent comparison |
| Temp directory management | Manual mkdir/cleanup | `fs.mkdtempSync()` + `fs.rmSync()` in beforeEach/afterEach | OS handles unique naming, cleanup is guaranteed |
| CLI execution | Shell string concatenation | `execFileSync(process.execPath, [args])` | Avoids shell injection, handles paths with spaces |
| File counting | Manual directory walking | `fs.readdirSync().filter()` | Simple, matches installer's own verification approach |

**Key insight:** The installer already has well-defined verification functions (`verifyInstalled`, `verifyFileInstalled`, `writeManifest`, `fileHash`). The E2E tests should mirror their behavior — check existence + SHA256 integrity — not invent new verification approaches.

## Common Pitfalls

### Pitfall 1: GSD_TEST_MODE Leaking to Child Process
**What goes wrong:** Parent test file sets `process.env.GSD_TEST_MODE = '1'` at line 10. If this env var leaks to the `execFileSync` child process, the installer exports functions instead of running — tests see no output.
**Why it happens:** `execFileSync` inherits parent environment by default.
**How to avoid:** Explicitly pass env without GSD_TEST_MODE:
```javascript
env: { ...process.env, GSD_TEST_MODE: undefined }
// OR more explicitly:
const childEnv = { ...process.env };
delete childEnv.GSD_TEST_MODE;
```
**Warning signs:** Install produces no files, no error, empty stdout.

### Pitfall 2: Race Condition with Parallel Test Runners
**What goes wrong:** Tests may run in parallel with other test files. The installer uses `process.cwd()` for local installs, so each test MUST use its own isolated temp directory.
**Why it happens:** `node --test` runs files sequentially by default, but suites within a file may parallelize.
**How to avoid:** Use unique `fs.mkdtempSync()` per describe block. Never share temp dirs between test groups.

### Pitfall 3: Agent Extension Mismatch
**What goes wrong:** Tests check for `gsd-executor.md` but Copilot agents are installed as `gsd-executor.agent.md`.
**Why it happens:** Copilot is the ONLY runtime that renames agents from `.md` to `.agent.md` (line 2257 of install.js).
**How to avoid:** Assert `.agent.md` extension explicitly. The 11 agents should all be `gsd-*.agent.md`.

### Pitfall 4: Existing .github Directory Interference
**What goes wrong:** If the temp directory happens to have a `.github` dir from a previous failed test, install may behave differently (e.g., merge instructions instead of creating fresh).
**Why it happens:** Incomplete cleanup from a crashed test.
**How to avoid:** Use `fs.mkdtempSync()` (guaranteed unique). The `afterEach` cleanup with `fs.rmSync(tmpDir, { recursive: true, force: true })` handles both success and failure paths.

### Pitfall 5: skills/ vs skills/gsd-* Counting
**What goes wrong:** Tests count all entries in `skills/` but miss that `get-shit-done/` (router skill directory) is also in skills for some runtimes.
**Why it happens:** Copilot does NOT create a router skill (CONV-09 was discarded per STATE.md decisions). The `copyCommandsAsCopilotSkills` function creates only `gsd-*` directories.
**How to avoid:** Filter for `gsd-*` prefix when counting skills. Verified: install creates exactly 31 skill directories.

## Code Examples

Verified patterns from investigation of the actual codebase:

### Running Full Copilot Install
```javascript
// Source: Verified by running actual install in temp dir
const { execFileSync } = require('child_process');
const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

function runInstall(cwd, args = ['--copilot', '--local']) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}
```

### Verifying Skills Structure
```javascript
// Source: Matches installer output (verified in live E2E test)
const skillsDir = path.join(tmpDir, '.github', 'skills');
const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));

assert.strictEqual(skillDirs.length, 31, 'expected 31 skill directories');

for (const dir of skillDirs) {
  const skillMd = path.join(skillsDir, dir.name, 'SKILL.md');
  assert.ok(fs.existsSync(skillMd), `${dir.name}/SKILL.md exists`);
}
```

### Verifying Agent Files
```javascript
// Source: Verified — Copilot agents use .agent.md extension (install.js line 2257)
const agentsDir = path.join(tmpDir, '.github', 'agents');
const agents = fs.readdirSync(agentsDir)
  .filter(f => f.startsWith('gsd-') && f.endsWith('.agent.md'));

assert.strictEqual(agents.length, 11, 'expected 11 agent files');

// Verify specific agents exist
const expectedAgents = [
  'gsd-codebase-mapper.agent.md',
  'gsd-debugger.agent.md',
  'gsd-executor.agent.md',
  'gsd-integration-checker.agent.md',
  'gsd-phase-researcher.agent.md',
  'gsd-plan-checker.agent.md',
  'gsd-planner.agent.md',
  'gsd-project-researcher.agent.md',
  'gsd-research-synthesizer.agent.md',
  'gsd-roadmapper.agent.md',
  'gsd-verifier.agent.md',
];
assert.deepStrictEqual(agents.sort(), expectedAgents);
```

### Verifying Instructions With Markers
```javascript
// Source: install.js lines 20-21 (marker constants)
const instructionsPath = path.join(tmpDir, '.github', 'copilot-instructions.md');
const content = fs.readFileSync(instructionsPath, 'utf8');
assert.ok(content.includes('<!-- GSD Configuration'), 'has opening marker');
assert.ok(content.includes('<!-- /GSD Configuration -->'), 'has closing marker');
```

### Verifying Manifest Structure and Integrity
```javascript
// Source: install.js writeManifest() function (lines 1994-2041)
const manifestPath = path.join(tmpDir, '.github', 'gsd-file-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Structure checks
assert.ok(manifest.version, 'has version');
assert.ok(manifest.timestamp, 'has timestamp');
assert.ok(manifest.files, 'has files object');

// Category counts (verified: 97 engine + 31 skills + 11 agents = 139)
const entries = Object.keys(manifest.files);
const engineFiles = entries.filter(f => f.startsWith('get-shit-done/'));
const skillFiles = entries.filter(f => f.startsWith('skills/'));
const agentFiles = entries.filter(f => f.startsWith('agents/'));
assert.strictEqual(skillFiles.length, 31, '31 skill files in manifest');
assert.strictEqual(agentFiles.length, 11, '11 agent files in manifest');
assert.ok(engineFiles.length > 0, 'engine files in manifest');

// SHA256 integrity: verify each hash matches actual file
for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
  const fullPath = path.join(tmpDir, '.github', relPath);
  assert.ok(fs.existsSync(fullPath), `${relPath} exists on disk`);
  const content = fs.readFileSync(fullPath);
  const actualHash = crypto.createHash('sha256').update(content).digest('hex');
  assert.strictEqual(actualHash, expectedHash, `SHA256 match for ${relPath}`);
}
```

### Running Uninstall
```javascript
function runUninstall(cwd) {
  const env = { ...process.env };
  delete env.GSD_TEST_MODE;
  return execFileSync(process.execPath, [INSTALL_PATH, '--copilot', '--local', '--uninstall'], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  });
}
```

### Verifying Clean Uninstall
```javascript
// Source: Verified by running actual uninstall in temp dir
const ghDir = path.join(tmpDir, '.github');

// GSD artifacts gone
assert.ok(!fs.existsSync(path.join(ghDir, 'get-shit-done')), 'engine dir removed');
assert.ok(!fs.existsSync(path.join(ghDir, 'copilot-instructions.md')), 'instructions removed');

// skills/ dir may still exist but has no gsd-* entries
if (fs.existsSync(path.join(ghDir, 'skills'))) {
  const remaining = fs.readdirSync(path.join(ghDir, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
  assert.strictEqual(remaining.length, 0, 'no gsd-* skills remain');
}

// agents/ dir may still exist but has no gsd-*.agent.md files
if (fs.existsSync(path.join(ghDir, 'agents'))) {
  const remaining = fs.readdirSync(path.join(ghDir, 'agents'))
    .filter(f => f.startsWith('gsd-') && f.endsWith('.agent.md'));
  assert.strictEqual(remaining.length, 0, 'no gsd-* agents remain');
}
```

## Known Facts (Verified by Live Execution)

| Fact | Verified Value | How Verified |
|------|---------------|--------------|
| Skills installed | 31 directories (`gsd-*/SKILL.md`) | Ran install, counted output |
| Agents installed | 11 files (`gsd-*.agent.md`) | Ran install, listed agents/ |
| Agent extension | `.agent.md` (not `.md`) | install.js line 2257 + live test |
| Engine subdirs | bin, references, templates, workflows, CHANGELOG.md, VERSION | Ran install, listed get-shit-done/ |
| Manifest file count | 139 total (97 engine + 31 skills + 11 agents) | Parsed manifest JSON |
| Hash format | SHA-256 hex string, 64 chars | Checked manifest values |
| Manifest keys | `version`, `timestamp`, `files` | Parsed manifest JSON |
| Instructions markers | `<!-- GSD Configuration — managed by get-shit-done installer -->` / `<!-- /GSD Configuration -->` | install.js lines 20-21 |
| No hooks/settings for Copilot | install.js lines 2289 skip block | Code inspection |
| No package.json for Copilot | install.js lines 2289 skip block | Code inspection |
| Uninstall leaves empty dirs | `skills/`, `agents/`, `gsd-file-manifest.json` persist | Ran uninstall, checked residuals |
| Uninstall preserves non-GSD | `my-agent.md`, `my-skill/` survive | Ran uninstall with custom files |
| Instructions merge on existing | User content preserved, GSD section stripped | Ran uninstall with custom instructions |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unit-only testing of individual functions | Unit tests (P1-P3) + E2E install/uninstall tests (P4) | Phase 4 | Complete coverage of install output |
| No SHA256 verification in tests | Manifest integrity checking | Phase 4 | Catches content corruption |

## Open Questions

1. **Test local-only or both local + global?**
   - What we know: Copilot supports both `--local` (.github/) and `--global` (~/.copilot/). The test pattern is identical — just different target dirs.
   - What's unclear: Global tests write to `~/.copilot/` which could conflict with real installations.
   - Recommendation: **Test local-only.** Global uses same code paths — only `targetDir` differs. Testing global risks polluting real user config. This is Claude's discretion per CONTEXT.md.

2. **Should we verify CONV-06/CONV-07 transformations in E2E?**
   - What we know: These are already tested extensively in unit tests (lines 260-410 of existing file).
   - Recommendation: **No.** E2E focuses on structure/existence/integrity. Content transformations are well-covered by unit tests.

3. **What about the `get-shit-done/` router skill?**
   - What we know: CONV-09 was discarded per STATE.md. No router skill directory is created at `skills/get-shit-done/`.
   - Recommendation: E2E should verify `skills/` contains exactly 31 `gsd-*` dirs and nothing else GSD-related.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` lines 2115-2358 — `install()` function for Copilot flow
- `bin/install.js` lines 1462-1700 — `uninstall()` function for Copilot flow
- `bin/install.js` lines 1994-2041 — `writeManifest()` function
- `bin/install.js` lines 2657-2684 — `GSD_TEST_MODE` exports (shows what's exported vs. not)
- `tests/copilot-install.test.cjs` — existing 81 tests, 975 lines
- `tests/helpers.cjs` — test helper patterns (createTempProject, cleanup)
- Live E2E execution — ran full install and uninstall in temp dirs, verified all outputs

### Secondary (MEDIUM confidence)
- `scripts/run-tests.cjs` — test runner config (uses `node --test`)
- `.planning/STATE.md` — accumulated project decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all built-in Node.js, same as existing 81 tests
- Architecture: HIGH — verified by running actual install/uninstall in temp dirs
- Pitfalls: HIGH — GSD_TEST_MODE leak and .agent.md extension discovered through code analysis
- File counts: HIGH — verified 31 skills, 11 agents, 139 manifest entries via live execution

**Research date:** 2026-03-03
**Valid until:** Stable — installer code is frozen for Phase 4 (tests only, no changes)
