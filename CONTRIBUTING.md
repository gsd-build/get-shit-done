# Contributing to GSD

## Getting Started

```bash
# Clone the repo
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done

# Install dependencies
npm install

# Run tests
npm test
```

---

## Types of Contributions

GSD accepts three types of contributions. Each type has a different process and a different bar for acceptance. **Read this section before opening anything.**

### 🐛 Fix (Bug Report)

A fix corrects something that is broken, crashes, produces wrong output, or behaves contrary to documented behavior.

**Process:**
1. Open a [Bug Report issue](https://github.com/gsd-build/get-shit-done/issues/new?template=bug_report.yml) — fill it out completely.
2. Wait for a maintainer to confirm it is a bug (label: `confirmed-bug`). For obvious, reproducible bugs this is typically fast.
3. Fix it. Write a test that would have caught the bug.
4. Open a PR using the [Fix PR template](.github/PULL_REQUEST_TEMPLATE/fix.md) — link the confirmed issue.

**Rejection reasons:** Not reproducible, works-as-designed, duplicate of an existing issue.

---

### ⚡ Enhancement

An enhancement improves an existing feature — better output, faster execution, cleaner UX, expanded edge-case handling. It does **not** add new commands, new workflows, or new concepts.

**The bar:** Enhancements must have a scoped written proposal approved by a maintainer before any code is written. A PR for an enhancement will be closed without review if the linked issue does not carry the `approved-enhancement` label.

**Process:**
1. Open an [Enhancement issue](https://github.com/gsd-build/get-shit-done/issues/new?template=enhancement.yml) with the full proposal.  The issue template requires: the problem being solved, the concrete benefit, the scope of changes, and alternatives considered.
2. **Wait for maintainer approval.** A maintainer must label the issue `approved-enhancement` before you write a single line of code. Do not open a PR against an unapproved enhancement issue — it will be closed.
3. Write the code. Keep the scope exactly as approved. If scope creep occurs, comment on the issue and get re-approval before continuing.
4. Open a PR using the [Enhancement PR template](.github/PULL_REQUEST_TEMPLATE/enhancement.md) — link the approved issue.

**Rejection reasons:** Issue not labeled `approved-enhancement`, scope exceeds what was approved, no written proposal, duplicate of existing behavior.

---

### ✨ Feature

A feature adds something new — a new command, a new workflow, a new concept, a new integration. Features have the highest bar because they add permanent maintenance burden to a solo-developer tool maintained by a small team.

**The bar:** Features require a complete written specification approved by a maintainer before any code is written. A PR for a feature will be closed without review if the linked issue does not carry the `approved-feature` label. Incomplete specs are closed, not revised by maintainers.

**Process:**
1. **Discuss first** — check [Discussions](https://github.com/gsd-build/get-shit-done/discussions) to see if the idea has been raised. If it has and was declined, don't open a new issue.
2. Open a [Feature Request issue](https://github.com/gsd-build/get-shit-done/issues/new?template=feature_request.yml) with the complete spec. The template requires: the solo-developer problem being solved, what is being added, full scope of affected files and systems, user stories, acceptance criteria, and assessment of maintenance burden.
3. **Wait for maintainer approval.** A maintainer must label the issue `approved-feature` before you write a single line of code. Approval is not guaranteed — GSD is intentionally lean and many valid ideas are declined because they conflict with the project's design philosophy.
4. Write the code. Implement exactly the approved spec. Changes to scope require re-approval.
5. Open a PR using the [Feature PR template](.github/PULL_REQUEST_TEMPLATE/feature.md) — link the approved issue.

**Rejection reasons:** Issue not labeled `approved-feature`, spec is incomplete, scope exceeds what was approved, feature conflicts with GSD's solo-developer focus, maintenance burden too high.

---

## The Issue-First Rule — No Exceptions

> **No code before approval.**

For **fixes**: open the issue, confirm it's a bug, then fix it.
For **enhancements**: open the issue, get `approved-enhancement`, then code.
For **features**: open the issue, get `approved-feature`, then code.

PRs that arrive without a properly-labeled linked issue are closed automatically. This is not a bureaucratic hurdle — it protects you from spending time on work that will be rejected, and it protects maintainers from reviewing code for changes that were never agreed to.

---

## Pull Request Guidelines

### Architecture & Domain Standards (Maintainer-Defined)

The following files are maintainer-owned coding standards and must be treated as canonical when contributing:

- `CONTEXT.md` — domain language and module naming standards
- `docs/adr/` — Architecture Decision Records (ADRs) for accepted architectural decisions

Contributor requirements:
- Read `CONTEXT.md` before naming or refactoring modules/interfaces/seams.
- Use `CONTEXT.md` vocabulary consistently in code comments, tests, issue/PR text, and docs for the touched area.
- Check relevant ADRs in `docs/adr/` before proposing or implementing architectural changes.
- If a change intentionally revisits an ADR decision, call it out explicitly in the linked issue and PR rationale.
- Do not rewrite maintainer intent in `CONTEXT.md`/ADRs as part of drive-by cleanup; propose focused updates tied to approved scope.

**Every PR must link to an approved issue.** PRs without a linked issue are closed without review, no exceptions.

- **No draft PRs** — draft PRs are automatically closed. Only open a PR when it is complete, tested, and ready for review. If your work is not finished, keep it on your local branch until it is.
- **Use the correct PR template** — there are separate templates for [Fix](.github/PULL_REQUEST_TEMPLATE/fix.md), [Enhancement](.github/PULL_REQUEST_TEMPLATE/enhancement.md), and [Feature](.github/PULL_REQUEST_TEMPLATE/feature.md). Using the wrong template or using the default template for a feature is a rejection reason.
- **Link with a closing keyword** — use `Closes #123`, `Fixes #123`, or `Resolves #123` in the PR body. The CI check will fail and the PR will be auto-closed if no valid issue reference is found.
- **One concern per PR** — bug fixes, enhancements, and features must be separate PRs
- **No drive-by formatting** — don't reformat code unrelated to your change
- **CI must pass** — all matrix jobs (Ubuntu × Node 22, 24; macOS × Node 24) must be green
- **Scope matches the approved issue** — if your PR does more than what the issue describes, the extra changes will be asked to be removed or moved to a new issue

## CHANGELOG Entries — Drop a Fragment

**Do not edit `CHANGELOG.md` directly.** Two PRs that both append to a `### Fixed` block always conflict on merge — git can't pick a serialization order without a human. Instead, every PR with user-facing changes drops a fragment file in `.changeset/`.

```bash
npm run changeset -- --type Fixed --pr <YOUR_PR_NUMBER> \
  --body "**\`/gsd-foo\` no longer drops trailing slashes** — explain the user-visible change."
```

This writes `.changeset/<adjective>-<noun>-<noun>.md`. Three random words → concurrent PRs never collide. Allowed `type:` values follow [Keep a Changelog](https://keepachangelog.com/): `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

Fragments are consolidated into `CHANGELOG.md` at release time by the release workflow. See [`.changeset/README.md`](.changeset/README.md) for the format spec and [#2975](https://github.com/gsd-build/get-shit-done/issues/2975) for the rationale.

**CI enforcement:** the `Changeset Required` workflow (`scripts/changeset/lint.cjs`) fails any PR that touches `bin/`, `get-shit-done/`, `agents/`, `commands/`, `hooks/`, or `sdk/src/` without a `.changeset/*.md` fragment.

**Opt-out:** PRs with no user-facing impact (test refactors, lint config changes, CI tweaks, formatting-only changes) can add the `no-changelog` label. The lint honors it. When unsure whether a change is user-facing, **add the fragment**.

## Testing Standards

All tests use Node.js built-in test runner (`node:test`) and assertion library (`node:assert`). **Do not use Jest, Mocha, Chai, or any external test framework.**

### Required Imports

```javascript
const { describe, it, test, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
```

### Setup and Cleanup

There are two approved cleanup patterns. Choose the one that fits the situation.

**Pattern 1 — Shared fixtures (`beforeEach`/`afterEach`):** Use when all tests in a `describe` block share identical setup and teardown. This is the most common case.

```javascript
// GOOD — shared setup/teardown with hooks
describe('my feature', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('does the thing', () => {
    assert.strictEqual(result, expected);
  });
});
```

**Pattern 2 — Per-test cleanup (`t.after()`):** Use when individual tests require unique teardown that differs from other tests in the same block.

```javascript
// GOOD — per-test cleanup when each test needs different teardown
test('does the thing with a custom setup', (t) => {
  const tmpDir = createTempProject('custom-prefix');
  t.after(() => cleanup(tmpDir));

  assert.strictEqual(result, expected);
});
```

**Never use `try/finally` inside test bodies.** It is verbose, masks test failures, and is not an approved pattern in this project.

```javascript
// BAD — try/finally inside a test body
test('does the thing', () => {
  const tmpDir = createTempProject();
  try {
    assert.strictEqual(result, expected);
  } finally {
    cleanup(tmpDir); // masks failures — don't do this
  }
});
```

> `try/finally` is only permitted inside standalone utility or helper functions that have no access to test context.

### Use Centralized Test Helpers

Import helpers from `tests/helpers.cjs` instead of inlining temp directory creation:

```javascript
const { createTempProject, createTempGitProject, createTempDir, cleanup, runGsdTools } = require('./helpers.cjs');
```

| Helper | Creates | Use When |
|--------|---------|----------|
| `createTempProject(prefix?)` | tmpDir with `.planning/phases/` | Testing GSD tools that need planning structure |
| `createTempGitProject(prefix?)` | Same + git init + initial commit | Testing git-dependent features |
| `createTempDir(prefix?)` | Bare temp directory | Testing features that don't need `.planning/` |
| `cleanup(tmpDir)` | Removes directory recursively | Always use in `afterEach` |
| `runGsdTools(args, cwd, env?)` | Executes gsd-tools.cjs | Testing CLI commands |

### Test Structure

```javascript
describe('featureName', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Additional setup specific to this suite
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('handles normal case', () => {
    // Arrange
    // Act
    // Assert
  });

  test('handles edge case', () => {
    // ...
  });

  describe('sub-feature', () => {
    // Nested describes can have their own hooks
    beforeEach(() => {
      // Additional setup for sub-feature
    });

    test('sub-feature works', () => {
      // ...
    });
  });
});
```

### Fixture Data Formatting

Template literals inside test blocks inherit indentation from the surrounding code. This can introduce unexpected leading whitespace that breaks regex anchors and string matching. Construct multi-line fixture strings using array `join()` instead:

```javascript
// GOOD — no indentation bleed
const content = [
  'line one',
  'line two',
  'line three',
].join('\n');

// BAD — template literal inherits surrounding indentation
const content = `
  line one
  line two
  line three
`;
```

### Prohibited: Source-Grep Tests

**Never read source-code `.cjs` files with `readFileSync` to assert that strings exist within them.** This is source-grep theater: it proves a literal is present in a file, not that the feature works at runtime.

```javascript
// BAD — source-grep theater
const configSrc = fs.readFileSync(
  path.join(GSD_ROOT, 'bin', 'lib', 'config-schema.cjs'), 'utf-8'
);
assert.ok(
  configSrc.includes("'workflow.plan_bounce'"),
  'VALID_CONFIG_KEYS should contain workflow.plan_bounce'
);
```

This test passes even if `workflow.plan_bounce` is present but misspelled in the schema, removed from the validation path, or moved to a different file under a different name. It survives every behavioral regression and fails only on trivial renames.

The correct pattern for config key tests — use the CLI:

```javascript
// GOOD — behavioral test via the CLI
test('config-set accepts workflow.plan_bounce', (t) => {
  const tmpDir = createTempProject();
  t.after(() => cleanup(tmpDir));

  const result = runGsdTools('config-set workflow.plan_bounce true', tmpDir);
  assert.ok(result.success, `config-set should accept workflow.plan_bounce: ${result.error}`);

  const configPath = path.join(tmpDir, '.planning', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  assert.strictEqual(config.workflow?.plan_bounce, true, 'value must be persisted');
});
```

This single test covers key registration in `VALID_CONFIG_KEYS`, the key's namespace resolution in `KNOWN_TOP_LEVEL`, and value persistence — all behaviors that the source-grep test could not touch.

**Why this pattern broke at scale:** Commit `990c3e64` in this repo updated 5 source-grep tests in one pass when `VALID_CONFIG_KEYS` moved between files. Zero of those tests were testing behavior. If they had been behavioral tests, the migration would have been invisible.

**CI enforcement:** A linter (`scripts/lint-no-source-grep.cjs`, run as `npm run lint:tests`) detects violations. Any test file that calls `readFileSync` on a `.cjs` path in a source directory without the exemption annotation below will fail the `lint-tests` CI job.

### Exception: `allow-test-rule: <reason>`

Some tests legitimately read source files. There are six recognized categories:

| Reason | When to use |
|--------|-------------|
| `source-text-is-the-product` | Agent `.md`, workflow `.md`, command `.md` files — their text IS what the runtime loads. Testing text content tests the deployed contract. |
| `architectural-invariant` | Implementation must use a specific primitive (e.g., `Atomics.wait`, atomic file writes) that cannot be tested by observing outputs. |
| `structural-regression-guard` | A specific code pattern must (or must not) exist to prevent a class of bug (e.g., regex global-state misuse). Behavioral tests cannot distinguish which pattern was used. |
| `docs-parity` | A reference doc must stay in sync with source-defined constants (e.g., `CONFIG_DEFAULTS`). The source is the canonical list; there is no runtime API to enumerate it. |
| `integration-test-input` | A source file is used as a real fixture input to a transformation function under test — the file is not inspected for strings but passed as data. |
| `structural-implementation-guard` | A feature's interception or wiring point is not reachable end-to-end via `runGsdTools`. Used temporarily until a behavioral path exists. |
| `pending-migration-to-typed-ir` | **Tracked for correction, not exempted.** Test was identified by the lint as carrying a raw-text-matching pattern that contradicts the rule above. Each annotated file MUST cite the open migration issue (e.g. `// allow-test-rule: pending-migration-to-typed-ir [#NNNN]`) so the tracking is auditable. New tests cannot use this category — they must refactor production to expose typed IR. The annotation is removed when the test is corrected. |

Annotate with a standalone `//` comment before the file's opening block comment:

```javascript
// allow-test-rule: architectural-invariant
// state.cjs locking must use Atomics.wait(), not a spin-loop. Behavioral tests
// cannot observe which sleep primitive was chosen — only source inspection can.

/**
 * Regression tests for locking bugs #1909...
 */
```

The annotation **must** be a standalone `// allow-test-rule:` line, not inside a `/** */` block comment — the CI linter scans for the pattern `// allow-test-rule:`.

### Prohibited: Raw Text Matching on Test Outputs (file content, stdout, stderr)

**Source-grep is not just `readFileSync` of a `.cjs` file.** The same anti-pattern shows up wherever a test pattern-matches against text that a system-under-test produced, regardless of whether that text came from a source file, a rendered shim, a child process's stdout, or a free-form `reason` string. **All forms are forbidden.**

The following are all violations of the same rule:

```javascript
// BAD — substring match on text written by the code under test
const cmdContent = fs.readFileSync(path.join(tmpDir, 'gsd-sdk.cmd'), 'utf8');
assert.ok(cmdContent.includes(`@node ${jsonQuoted} %*`), '.cmd embeds shim path');

// BAD — regex match on a child process's human-readable stdout formatter
const r = cp.spawnSync(SCRIPT, ['--patches-dir', dir]);
assert.match(r.stdout, /Failures: 1/);
assert.match(r.stdout, /not a regular file/);

// BAD — "structured parser" that hides string ops behind a function wrapper
function parseCmdShim(content) {
  const lines = content.split('\r\n').filter((l) => l.length > 0);
  return { header: lines[0], usesCRLF: content.includes('\r\n') };
}

// BAD — assert.match on a free-form `reason` string from a JSON report
assert.ok(/not a regular file/.test(report.results[0].reason));
```

Each of these passes on accidental near-matches (a comment containing `@node` somewhere, a stack trace that happens to say `Failures: 1`, a mis-typed reason that still contains the substring you're matching) and fails on harmless reformatting (changing `Failures: 1` to `1 failure`, swapping CRLF rendering style, rewording the error prose).

#### The rule

> **Tests assert on typed structured values. If the code under test produces text, the code under test must also expose a structured intermediate representation, and the test must assert on that IR — never on the rendered text.**

Concretely: for any system-under-test that produces text output (a file renderer, a CLI formatter, an error-message builder), the production code MUST expose a typed alternative that the test consumes:

| Output kind | Required structured surface | What the test asserts on |
|---|---|---|
| Rendered file (shim, template, generated code) | A pure builder function returning the IR (`{ invocation, eol, fileNames, render }`) | `triple.invocation.target === expected`, `triple.eol.cmd === '\r\n'` |
| CLI human-formatter output | A `--json` mode that emits the same data structurally | `report.results[0].reason === REASON.FAIL_INSTALLED_NOT_REGULAR_FILE` |
| Error / status / reason | A frozen enum (`Object.freeze({ FAIL_X: 'fail_x', ... })`) | `assert.equal(result.reason, REASON.FAIL_X)` |
| File presence after a write | `fs.statSync().isFile()`, `.size > 0`, `.mtimeMs` advances | Filesystem facts; never read the file content back |

#### Concrete examples from this repo

`buildWindowsShimTriple(shimSrc)` in `bin/install.js` is the canonical IR pattern: pure function, no I/O, returns `{ invocation, eol, fileNames, render }`. `trySelfLinkGsdSdkWindows` calls it and writes `triple.render[kind]()` to disk. Tests assert on `triple.invocation.target`, `triple.eol.cmd`, `Object.keys(triple).sort()` — never on the rendered text. Filesystem-level tests assert `fs.statSync(target).size === Buffer.byteLength(triple.render.cmd())` to prove the writer writes what the renderer produces, **without comparing content**.

`scripts/verify-reapply-patches.cjs` exposes a frozen `REASON` enum and emits it through `--json`. Tests assert `report.results[0].reason === REASON.FAIL_USER_LINES_MISSING`. The human formatter exists for operator console output only — tests must not depend on its prose. Adding a new reason code requires updating the `REASON` enum, the `--json` output, AND the test that locks `Object.keys(REASON).sort()` — three coordinated changes that prevent the code surface from drifting from the test surface.

#### Hiding grep behind a function is still grep

`parseCmdShim`, `parsePs1Invocation`, etc. that internally do `content.split(...)`, `lines[1].trim()`, `content.includes(...)` are still string manipulation. The fact that the entry point looks like a parser doesn't change what's happening underneath — the test is still asserting on the lexical shape of rendered text. The fix is not "wrap the grep in a function with a typed-looking return value." The fix is to **eliminate the rendered text from the test path entirely** by surfacing the IR.

#### When you cannot eliminate text matching

There are exactly two cases where text content is the legitimate object of a test, both already covered by the existing exemption matrix:

1. `source-text-is-the-product` — workflow `.md` / agent `.md` / command `.md` files where the deployed text IS what the runtime loads.
2. `docs-parity` — a reference doc must mirror source-defined constants and there is no runtime enumeration API.

For everything else, if a test reaches for `.includes()` / `.startsWith()` / `assert.match(text, /…/)`, the production code is missing a typed surface. **Add the typed surface; do not work around it.**

**CI enforcement:** `scripts/lint-no-source-grep.cjs` is being extended (see issue tracker for the latest scope) to flag `String#includes`/`String#startsWith`/`String#endsWith`/`assert.match` on `readFileSync` results and on `cp.spawnSync` stdout/stderr in test files, with the same `// allow-test-rule:` exemption mechanism.

### Node.js Version Compatibility

**Node 22 is the minimum supported version.** Node 24 is the primary CI target. All tests must pass on both.

| Version | Status |
|---------|--------|
| **Node 22** | Minimum required — Active LTS until October 2026, Maintenance LTS until April 2027 |
| **Node 24** | Primary CI target — current Active LTS, all tests must pass |
| Node 26 | Forward-compatible target — avoid deprecated APIs |

Do not use:
- Deprecated APIs
- APIs not available in Node 22

Safe to use:
- `node:test` — stable since Node 18, fully featured in 24
- `describe`/`it`/`test` — all supported
- `beforeEach`/`afterEach`/`before`/`after` — all supported
- `t.after()` — per-test cleanup
- `t.plan()` — fully supported
- Snapshot testing — fully supported

### Assertions

Use `node:assert/strict` for strict equality by default:

```javascript
const assert = require('node:assert/strict');

assert.strictEqual(actual, expected);      // ===
assert.deepStrictEqual(actual, expected);  // deep ===
assert.ok(value);                          // truthy
assert.throws(() => { ... }, /pattern/);   // throws
assert.rejects(async () => { ... });       // async throws
```

### Running Tests

```bash
# Run all tests
npm test

# Run a single test file
node --test tests/core.test.cjs

# Run with coverage
npm run test:coverage
```

### Pre-PR Seam Checks (Manifest/Alias Routing)

If you touched any of the command-manifest or generated alias files, run:

```bash
npm run check:alias-drift
```

This verifies generated alias artifacts are in sync with manifest source-of-truth.

Optional local pre-commit hook entry (Git-native):

```bash
# one-time setup
mkdir -p .githooks
cat > .githooks/pre-commit <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if git diff --cached --name-only | grep -Eq "^sdk/src/query/command-manifest\.|^sdk/src/query/command-aliases\.generated\.ts$|^get-shit-done/bin/lib/command-aliases\.generated\.cjs$|^sdk/scripts/gen-command-aliases\.ts$"; then
  npm run check:alias-drift
fi
EOF
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

Optional local pre-push hook to block a private author-email pattern:

```bash
# set locally in your shell profile (example)
export GSD_BLOCKED_AUTHOR_REGEX='@example-corp\\.com$'

cat > .githooks/pre-push <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

zero_sha='0000000000000000000000000000000000000000'
blocked_regex="${GSD_BLOCKED_AUTHOR_REGEX:-}"
[[ -z "$blocked_regex" ]] && exit 0
violations=()

while read -r local_ref local_sha remote_ref remote_sha; do
  [[ "$local_sha" == "$zero_sha" ]] && continue
  if [[ "$remote_sha" == "$zero_sha" ]]; then
    commits=$(git rev-list "$local_sha" --not --remotes)
  else
    commits=$(git rev-list "$remote_sha..$local_sha")
  fi
  while read -r commit; do
    [[ -z "$commit" ]] && continue
    email=$(git show -s --format='%ae' "$commit" | tr '[:upper:]' '[:lower:]')
    if printf '%s' "$email" | grep -Eq "$blocked_regex"; then
      violations+=("$commit <$email>")
    fi
  done <<< "$commits"
done

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "Push blocked: commit author email matched local blocked regex ($blocked_regex)." >&2
  printf '  - %s\n' "${violations[@]}" >&2
  exit 1
fi
EOF
chmod +x .githooks/pre-push
```

### CI Test Quality Checks

The following checks run on every PR in addition to the test suite:

| Job | What it checks | How to pass |
|-----|----------------|-------------|
| `lint-tests` | No source-grep tests (see above) | Replace with `runGsdTools()` behavioral tests, or add `// allow-test-rule: <reason>` |

Run locally before pushing: `npm run lint:tests`

### Test Requirements by Contribution Type

### Architecture-Aware Testing Requirements

When work touches architecture, routing, policy, registry assembly, or command semantics:
- Write tests against module **interfaces** and seam behavior, not implementation trivia.
- Prefer invariant/contract tests that protect ADR-backed behavior and `CONTEXT.md` terminology.
- Ensure tests validate canonical behavior through the defined seam (for example: structured result contracts, canonical command metadata, and adapter parity), not source-text coupling.
- If ADRs define expected behavior, tests should assert those expectations directly.

The required tests differ depending on what you are contributing:

**Bug Fix:** A regression test is required. Write the test first — it must demonstrate the original failure before your fix is applied, then pass after the fix. A PR that fixes a bug without a regression test will be asked to add one. "Tests pass" does not prove correctness; it proves the bug isn't present in the tests that exist.

**Enhancement:** Tests covering the enhanced behavior are required. Update any existing tests that test the area you changed. Do not leave tests that pass but no longer accurately describe the behavior.

**Feature:** Tests are required for the primary success path and at minimum one failure scenario. Leaving gaps in test coverage for a new feature is a rejection reason.

**Behavior Change:** If your change modifies existing behavior, the existing tests covering that behavior must be updated or replaced. Leaving passing-but-incorrect tests in the suite is not acceptable — a test that passes but asserts the old (now wrong) behavior makes the suite less useful than no test at all.

### Reviewer Standards

Reviewers do not rely solely on CI to verify correctness. Before approving a PR, reviewers:

- Build locally (`npm run build` if applicable)
- Run the full test suite locally (`npm test`)
- Confirm regression tests exist for bug fixes and that they would fail without the fix
- Validate that the implementation matches what the linked issue described — green CI on the wrong implementation is not an approval signal

**"Tests pass in CI" is not sufficient for merge.** The implementation must correctly solve the problem described in the linked issue.

## Code Style

- **CommonJS** (`.cjs`) — the project uses `require()`, not ESM `import`
- **No external dependencies in core** — `gsd-tools.cjs` and all lib files use only Node.js built-ins
- **Conventional commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`

## File Structure

```
bin/install.js          — Installer (multi-runtime)
get-shit-done/
  bin/lib/              — Core library modules (.cjs)
  workflows/            — Workflow definitions (.md)
                          Large workflows split per progressive-disclosure
                          pattern: workflows/<name>/modes/*.md +
                          workflows/<name>/templates/*. Parent dispatches
                          to mode files. See workflows/discuss-phase/ as
                          the canonical example (#2551). New modes for
                          discuss-phase land in
                          workflows/discuss-phase/modes/<mode>.md.
                          Per-file budgets enforced by
                          tests/workflow-size-budget.test.cjs.
  references/           — Reference documentation (.md)
  templates/            — File templates
agents/                 — Agent definitions (.md) — CANONICAL SOURCE
commands/gsd/           — Slash command definitions (.md)
tests/                  — Test files (.test.cjs)
  helpers.cjs           — Shared test utilities
docs/                   — User-facing documentation
```

### Source of truth for agents

Only `agents/` at the repo root is tracked by git. The following directories may exist on a developer machine with GSD installed and **must not be edited** — they are install-sync outputs and will be overwritten:

| Path | Gitignored | What it is |
|------|-----------|------------|
| `.claude/agents/` | Yes (`.gitignore:9`) | Local Claude Code runtime sync |
| `.cursor/agents/` | Yes (`.gitignore:12`) | Local Cursor IDE bundle |
| `.github/agents/gsd-*` | Yes (`.gitignore:37`) | Local CI-surface bundle |

If you find that `.claude/agents/` has drifted from `agents/` (e.g., after a branch change), re-run `bin/install.js` to re-sync from the canonical source. Always edit `agents/` — never the derivative directories.

## Security

- **Path validation** — use `validatePath()` from `security.cjs` for any user-provided paths
- **No shell injection** — use `execFileSync` (array args) over `execSync` (string interpolation)
- **No `${{ }}` in GitHub Actions `run:` blocks** — bind to `env:` mappings first
