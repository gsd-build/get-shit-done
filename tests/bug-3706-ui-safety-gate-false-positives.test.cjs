'use strict';

/**
 * Tests for bug #3706 (word-boundary anchoring) and #3718 (cross-shell portability).
 *
 * Root cause (#3706): grep -iE "UI|..." had no word-boundary anchoring, causing
 * false-positives on "Requirements" (contains "ui"), "overview" ("view"), etc.
 *
 * Root cause (#3718): shell-based invocation (with locale env-var prefix) silently
 * degrades on Windows PowerShell — the prefix is not recognised by pwsh.
 *
 * Fix (#3718, Approach A): gate logic moved to `bin/lib/ui-safety-gate.cjs` (Node.js).
 * Reads phase text from STDIN (not argv) to avoid OS ARG_MAX limits.
 * Invoked as: printf '%s' "$PHASE_SECTION" | node "${GSD_REPO_ROOT}/bin/lib/ui-safety-gate.cjs"
 * Path anchored to repo root via `git rev-parse --show-toplevel`.
 *
 * Test strategy:
 *   1. Import the helper module directly and assert correct results on the full fixture
 *      matrix (exercises the production code path).
 *   2. Spawn the helper as a child process with shell:false and input on stdin to prove
 *      cross-shell portability — spawnSync with shell:false bypasses any host shell.
 *   3. Assert the workflow .md files now invoke `node ... ui-safety-gate.cjs` via stdin
 *      rather than the old shell-based invocation (structural guard against regression).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('node:child_process');

const HELPER_PATH = path.join(__dirname, '..', 'bin', 'lib', 'ui-safety-gate.cjs');
const PLAN_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');
const AUTONOMOUS_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'autonomous.md');

const { checkUiPresence } = require(HELPER_PATH);

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Mirrors the old `hasUiGate` helper for backwards-compatible assertions.
 * Returns 0 (UI found) or 1 (not found), matching grep exit code semantics.
 */
function hasUiGate(text) {
  return checkUiPresence(text).hasUI ? 0 : 1;
}

/**
 * Spawn the helper with shell:false, passing input via stdin.
 * Returns the spawnSync result object.
 */
function spawnGate(input) {
  return spawnSync(process.execPath, [HELPER_PATH], {
    shell: false,
    encoding: 'utf-8',
    input: input,
  });
}

// ── Structural guard — workflow files now invoke Node via stdin ───────────────

describe('Workflow .md structural guard (#3718)', () => {
  // allow-test-rule: source-text-is-the-product
  // The UI safety gate invocation is embedded in workflow prose-as-code.
  // These structural tests guard against regression where someone re-introduces
  // the shell-based locale-prefix invocation that silently breaks on Windows PowerShell.
  for (const [label, filePath] of [
    ['plan-phase.md', PLAN_PHASE_PATH],
    ['autonomous.md', AUTONOMOUS_PATH],
  ]) {
    test(`${label} must invoke ui-safety-gate.cjs via stdin, anchored to GSD_REPO_ROOT`, () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(
        content.includes('ui-safety-gate.cjs'),
        `${label}: must reference ui-safety-gate.cjs for cross-shell portability (#3718)`
      );
      assert.ok(
        content.includes('GSD_REPO_ROOT'),
        `${label}: must anchor path to GSD_REPO_ROOT to avoid CWD-sensitive failure (#3718)`
      );
      assert.ok(
        content.includes('git rev-parse --show-toplevel'),
        `${label}: must derive GSD_REPO_ROOT from git rev-parse --show-toplevel`
      );
      // Confirm stdin pipe usage (printf or echo piped to node)
      assert.ok(
        content.includes('printf') || content.includes('echo'),
        `${label}: must pipe phase section via stdin (printf/echo | node) to avoid ARG_MAX`
      );
      assert.ok(
        !content.includes('LC_ALL=C grep'),
        `${label}: must NOT contain LC_ALL=C grep — that silently fails on Windows PowerShell (#3718)`
      );
    });
  }
});

// ── Cross-shell spawn test (#3718) ────────────────────────────────────────────

describe('Cross-shell portability — spawnSync with shell:false, stdin (#3718)', () => {
  test('spawn with shell:false + stdin: UI input exits 0', () => {
    const result = spawnGate('UI Refactor: migrate all screens');
    assert.strictEqual(result.status, 0, `Expected exit 0 (UI found), got ${result.status}. stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: non-UI input exits 1', () => {
    const result = spawnGate('Requirements: backend REST API only');
    assert.strictEqual(result.status, 1, `Expected exit 1 (no UI), got ${result.status}. stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: empty input exits 1', () => {
    const result = spawnGate('');
    assert.strictEqual(result.status, 1, `Expected exit 1 (no UI for empty input), got ${result.status}. stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: CRLF line endings handled correctly', () => {
    const result = spawnGate('Deploy to the cloud platform\r\nand configure CI/CD.');
    assert.strictEqual(result.status, 1, `CRLF "platform" must not trigger gate. stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: multi-line input with UI token exits 0', () => {
    const multiLine = 'Backend setup\nBuild the analytics dashboard\nand navigation component.';
    const result = spawnGate(multiLine);
    assert.strictEqual(result.status, 0, `Multi-line input with "dashboard" must exit 0. stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: very large input (>100KB) is handled without error', () => {
    // Verifies stdin transport does not hit ARG_MAX (argv transport fails above ~1MB on macOS).
    // Fixture uses pure backend prose — no standalone UI tokens.
    const largeInput = 'Backend service deployment and database migration step.\n'.repeat(3000);
    const result = spawnGate(largeInput);
    assert.strictEqual(result.status, 1, `Large non-UI input must exit 1, not crash. status: ${result.status}, stderr: ${result.stderr}`);
  });

  test('spawn with shell:false + stdin: large input with UI token exits 0', () => {
    const largeUiInput = 'Backend infrastructure setup.\n'.repeat(2999) + 'Build the analytics dashboard.\n';
    const result = spawnGate(largeUiInput);
    assert.strictEqual(result.status, 0, `Large input ending with UI token must exit 0. stderr: ${result.stderr}`);
  });
});

// ── Behavioral test matrix (via module import) ────────────────────────────────

/**
 * Full fixture matrix — exercises the production checkUiPresence() function directly.
 */
function runBehavioralTests(label) {
  describe(`${label} — UI gate behavioral matrix`, () => {

    // ── False-positive tests (must NOT match) ──────────────────────────────

    test('"Requirements" must NOT trigger UI gate (bug #3706 — "ui" substring)', () => {
      const phaseSection =
        '**Requirements**: The service must expose REST endpoints for authentication.\n' +
        'All work is server-side. Database migrations and API contract only.';
      assert.strictEqual(hasUiGate(phaseSection), 1, '"Requirements" must not match the UI gate');
    });

    test('"overview" must NOT trigger UI gate ("view" is a substring)', () => {
      assert.strictEqual(hasUiGate('Overview of the data pipeline architecture and backend services.'), 1);
    });

    test('"performance" must NOT trigger UI gate ("form" is a substring)', () => {
      assert.strictEqual(hasUiGate('Performance testing and benchmark analysis for the API layer.'), 1);
    });

    test('"platform" must NOT trigger UI gate ("form" is a substring)', () => {
      assert.strictEqual(hasUiGate('Deploy to the cloud platform and configure CI/CD.'), 1);
    });

    test('"transform" must NOT trigger UI gate ("form" is a substring)', () => {
      assert.strictEqual(hasUiGate('Transform raw event data and write to the warehouse.'), 1);
    });

    test('"review" must NOT trigger UI gate ("view" is a substring)', () => {
      assert.strictEqual(hasUiGate('Code review checklist and PR approval workflow for the API.'), 1);
    });

    test('"build" must NOT trigger UI gate ("ui" at positions 2-3 of "build")', () => {
      assert.strictEqual(hasUiGate('Build the backend service and run integration tests.'), 1);
    });

    test('"screening" must NOT trigger UI gate ("screen" is a substring)', () => {
      assert.strictEqual(hasUiGate('Implement candidate screening criteria for the hiring pipeline.'), 1);
    });

    test('empty input does NOT trigger UI gate', () => {
      assert.strictEqual(hasUiGate(''), 1);
    });

    test('whitespace-only input does NOT trigger UI gate', () => {
      assert.strictEqual(hasUiGate('   \n   \t   '), 1);
    });

    test('compound "microfrontend" (no separator) does NOT trigger gate — documented behavior', () => {
      assert.strictEqual(
        hasUiGate('Build the microfrontend shell application.'), 1,
        '"microfrontend" compound must NOT trigger gate'
      );
    });

    // ── True-positive tests (must match) ──────────────────────────────────

    test('standalone "UI" token DOES trigger UI gate', () => {
      assert.strictEqual(hasUiGate('UI Refactor: migrate all screens to the new design system.'), 0);
    });

    test('standalone "view" token DOES trigger UI gate', () => {
      assert.strictEqual(hasUiGate('Implement the user profile view controller and associated screen.'), 0);
    });

    test('standalone "form" token DOES trigger UI gate', () => {
      assert.strictEqual(hasUiGate('Build a sign-up form with client-side validation.'), 0);
    });

    test('"dashboard" DOES trigger UI gate', () => {
      assert.strictEqual(hasUiGate('Build the analytics dashboard and navigation component.'), 0);
    });

    test('lowercase "ui" token DOES trigger UI gate (case-insensitive)', () => {
      assert.strictEqual(hasUiGate('Redesign the ui for mobile responsiveness.'), 0);
    });

    test('"non-UI" hyphenated form DOES trigger UI gate (hyphen is a word boundary)', () => {
      assert.strictEqual(hasUiGate('This is a non-UI backend service with no visual elements.'), 0);
    });

    test('standalone "screen" token DOES trigger UI gate', () => {
      assert.strictEqual(hasUiGate('Implement the loading screen and splash animation.'), 0);
    });

    test('hyphenated "micro-frontend" DOES trigger gate (word boundary on hyphen)', () => {
      assert.strictEqual(hasUiGate('Build the micro-frontend shell application.'), 0);
    });

    // ── CRLF / edge case tests ─────────────────────────────────────────────

    test('CRLF line endings: non-UI text does not trigger gate', () => {
      assert.strictEqual(hasUiGate('Deploy to the cloud platform\r\nand configure CI/CD.'), 1);
    });

    test('CRLF line endings: UI token on second line triggers gate', () => {
      assert.strictEqual(hasUiGate('Backend setup complete.\r\nBuild the analytics dashboard.'), 0);
    });

    test('leading/trailing whitespace does not affect token detection', () => {
      assert.strictEqual(hasUiGate('  UI refactor phase  '), 0);
    });
  });
}

runBehavioralTests('ui-safety-gate.cjs');

// ── checkUiPresence() return value API ───────────────────────────────────────

describe('checkUiPresence() return value API', () => {
  test('returns { hasUI: true, tokens: [...] } when UI found', () => {
    const result = checkUiPresence('Build the dashboard and UI form');
    assert.strictEqual(result.hasUI, true);
    assert.ok(Array.isArray(result.tokens), 'tokens must be an array');
    assert.ok(result.tokens.length > 0, 'tokens must be non-empty when hasUI is true');
    assert.ok(result.tokens.includes('dashboard') || result.tokens.includes('ui') || result.tokens.includes('form'));
  });

  test('returns { hasUI: false, tokens: [] } when no UI found', () => {
    const result = checkUiPresence('Requirements: backend REST API only');
    assert.strictEqual(result.hasUI, false);
    assert.deepStrictEqual(result.tokens, []);
  });

  test('tokens are lowercased', () => {
    const result = checkUiPresence('UI Refactor');
    assert.ok(result.tokens.every(t => t === t.toLowerCase()), 'All tokens must be lowercase');
  });

  test('tokens are deduplicated', () => {
    const result = checkUiPresence('UI redesign and ui cleanup');
    const uiCount = result.tokens.filter(t => t === 'ui').length;
    assert.strictEqual(uiCount, 1, 'Duplicate tokens must be deduplicated');
  });

  test('non-string input returns { hasUI: false, tokens: [] }', () => {
    assert.deepStrictEqual(checkUiPresence(null), { hasUI: false, tokens: [] });
    assert.deepStrictEqual(checkUiPresence(undefined), { hasUI: false, tokens: [] });
    assert.deepStrictEqual(checkUiPresence(42), { hasUI: false, tokens: [] });
  });

  test('multiple distinct UI tokens on same line are ALL captured', () => {
    // "form" and "view" both appear as standalone words on one line.
    // Prior exec()-based impl only captured the first match per line.
    const result = checkUiPresence('Build a sign-up form with a view controller');
    assert.strictEqual(result.hasUI, true, 'hasUI must be true');
    assert.ok(result.tokens.includes('form'), `Expected "form" in tokens, got: ${JSON.stringify(result.tokens)}`);
    assert.ok(result.tokens.includes('view'), `Expected "view" in tokens, got: ${JSON.stringify(result.tokens)}`);
  });
});
