// allow-test-rule: source-text-is-the-product — agents/gsd-intel-updater.md IS
// the deployed agent instruction set. Asserting its text content tests the
// deployed behaviour contract, not internal implementation.

'use strict';

/**
 * Regression tests for bug #3290.
 *
 * The "Runtime layout detection" block in gsd-intel-updater.md ran
 * unconditionally on every project analysed, emitting:
 *
 *   Layout detection returned "unknown" — this project is not a GSD-system
 *   installation (no `.claude/get-shit-done/` or `.kilo/` runtime root).
 *
 * for every ordinary (non-GSD-framework) user project. The verdict was already
 * ignored by Steps 2-6 on non-GSD projects. The block was dead-but-noisy.
 *
 * Fix: gate the runtime bash detection on a positive "is-this-the-framework-
 * repo" check (package.json name === "get-shit-done-cc") so it runs ONLY when
 * analysing the GSD framework's own repo, OR remove the block entirely if no
 * downstream consumers exist.
 *
 * Group A — gating contract:
 *   The unconditional bash detection invocation must be absent OR wrapped in a
 *   framework-repo guard. A bare `ls -d .kilo ... || echo "unknown"` with no
 *   surrounding gate is the defect signature.
 *
 * Group B — no orphan consumers:
 *   Confirm no other agent, command, or workflow file reads/consumes the layout-
 *   detection verdict emitted by this block.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const AGENT_PATH = path.join(ROOT, 'agents', 'gsd-intel-updater.md');

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Walk a directory recursively and return absolute paths of all .md files. */
function walkMd(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(abs));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(abs);
    }
  }
  return results;
}

// ─── Group A — gating contract ───────────────────────────────────────────────

describe('bug #3290 — Group A: layout-detection block must be gated or absent', () => {
  let content;

  test('agent file exists', () => {
    assert.ok(fs.existsSync(AGENT_PATH), 'agents/gsd-intel-updater.md must exist');
    content = fs.readFileSync(AGENT_PATH, 'utf-8');
  });

  test(
    'bare unconditional detection invocation is absent — ' +
    'the "ls -d .kilo ... || echo unknown" must not appear outside a framework-repo gate',
    () => {
      content = content || fs.readFileSync(AGENT_PATH, 'utf-8');

      // The defect signature: the bash block runs unconditionally.
      // We look for the exact shell one-liner that emits the verdict.
      const bareDetectionPattern =
        /ls -d \.kilo\b.*\|\|.*echo "?unknown"?/;

      const hasBareDetection = bareDetectionPattern.test(content);

      if (!hasBareDetection) {
        // Block is fully removed — option B — pass.
        return;
      }

      // Block is still present. Verify it is surrounded by a framework-repo gate.
      // A valid gate checks package.json name or an equivalent positive signal
      // that the current project IS the GSD framework's own repo.
      const hasFrameworkGate =
        content.includes('get-shit-done-cc') ||
        content.includes('is-this-the-framework') ||
        content.includes('framework repo') ||
        content.includes('Only run') ||
        /if.*package\.json.*get-shit-done/i.test(content) ||
        /Only.*layout detection.*GSD framework/i.test(content) ||
        /Only.*layout detection.*framework/i.test(content);

      assert.ok(
        hasFrameworkGate,
        'agents/gsd-intel-updater.md contains a bare unconditional layout-detection ' +
        'bash block (`ls -d .kilo ... || echo unknown`) with no surrounding ' +
        'framework-repo gate (#3290). ' +
        'Either remove the block entirely, or wrap it in a check like:\n' +
        '  if [[ "$(jq -r \'.name // ""\' package.json 2>/dev/null)" == "get-shit-done-cc" ]]; then\n' +
        '    # ... detection block ...\n' +
        '  fi'
      );
    }
  );
});

// ─── Group B — no orphan downstream consumers ────────────────────────────────

describe('bug #3290 — Group B: layout-detection verdict has no downstream consumers', () => {
  const SOURCE_DIRS = [
    path.join(ROOT, 'agents'),
    path.join(ROOT, 'commands', 'gsd'),
    path.join(ROOT, 'get-shit-done', 'workflows'),
  ];

  /**
   * Lines that reference the three possible verdict values emitted by the
   * detection block: "claude", "kilo", "unknown" — ONLY as the verdict output
   * of the gsd-intel-updater layout detection (not general runtime references).
   *
   * We look for the specific phrase "Layout detection returned" which is the
   * sentinel the noisy output line uses.
   */
  test('no file contains "Layout detection returned" (the noisy verdict phrase)', () => {
    const matches = [];

    for (const dir of SOURCE_DIRS) {
      const files = walkMd(dir);
      for (const file of files) {
        const rel = path.relative(ROOT, file);
        const src = fs.readFileSync(file, 'utf-8');
        if (src.includes('Layout detection returned')) {
          // Collect matching lines for the error message
          const lines = src.split('\n')
            .map((l, i) => ({ line: l, n: i + 1 }))
            .filter(({ line }) => line.includes('Layout detection returned'));
          matches.push({ rel, lines });
        }
      }
    }

    assert.strictEqual(
      matches.length,
      0,
      'Expected zero files to contain "Layout detection returned" (the noisy verdict ' +
      'phrase from the gsd-intel-updater layout-detection block). Found:\n' +
      matches.map(({ rel, lines }) =>
        `  ${rel}:\n${lines.map(({ n, line }) => `    L${n}: ${line.trim()}`).join('\n')}`
      ).join('\n')
    );
  });

  test('no agent or workflow instructs reading the layout-detection verdict output', () => {
    // The verdict was: echo "kilo" | echo "claude" | echo "unknown"
    // If any file references "Layout detection returned unknown" as an instruction
    // to consume, that would be a consumer. We verify none exist outside of
    // the producing file (gsd-intel-updater.md).
    const verdictConsumerPattern = /Layout detection returned.*(unknown|claude|kilo)/i;
    const consumers = [];

    for (const dir of SOURCE_DIRS) {
      const files = walkMd(dir);
      for (const file of files) {
        // Exclude the producer itself — it defines the message, not consumes it
        if (path.basename(file) === 'gsd-intel-updater.md') continue;
        const src = fs.readFileSync(file, 'utf-8');
        if (verdictConsumerPattern.test(src)) {
          consumers.push(path.relative(ROOT, file));
        }
      }
    }

    assert.deepStrictEqual(
      consumers,
      [],
      'Expected no downstream consumer of the layout-detection verdict. Found:\n' +
      consumers.map((f) => `  ${f}`).join('\n') +
      '\nIf a consumer exists, use option A (gate) not option B (remove).'
    );
  });
});
