'use strict';

/**
 * GSD Tools Tests - extractCurrentMilestone shared semver prefix bug
 *
 * Bug: When STATE.md milestone field is a shared semver prefix (e.g. "v8.0")
 *   that appears in multiple ROADMAP.md headings — typically a closed
 *   sub-milestone (## v8.0 Overview — v8.0-F (CLOSED FAIL)) plus an active one
 *   (## v8.0-B Overview (STARTED)) — the original `'mi'` regex first-match
 *   returned the closed section. Downstream phase.insert / phase.complete /
 *   init.phase-op then failed with "Phase N not found in current milestone".
 *
 * Fix: enumerate all milestone-heading matches via `'gmi'` matchAll, skip
 *   headings containing closed markers (CLOSED|ARCHIVED|ABANDONED|SHIPPED|
 *   FAIL(ED)?|✅|🗄️), prefer first non-closed; fall back to first match if
 *   every candidate is closed (preserves legacy single-closed-milestone load).
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createTempProject, cleanup } = require('./helpers.cjs');

const CORE = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'core.cjs');
const { extractCurrentMilestone } = require(CORE);

function writeState(tmpDir, milestoneValue) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---\nmilestone: ${milestoneValue}\n---\n# State\n`
  );
}

describe('extractCurrentMilestone — shared semver prefix bug', () => {
  test('skips closed v8.0-F first match when active v8.0-B follows (STATE milestone: v8.0)', () => {
    const tmpDir = createTempProject('gsd-test-extract-prefix-');
    try {
      writeState(tmpDir, 'v8.0');
      const roadmap = [
        '# Project Roadmap',
        '',
        '## v8.0 Overview — v8.0-F (CLOSED FAIL 2026-05-18)',
        '',
        '- v8.0-F closed content here',
        '',
        '### Phase 24: ARCHIVED',
        '',
        '## v8.0-B Overview (STARTED 2026-05-18)',
        '',
        '- v8.0-B active content here',
        '',
        '### Phase 31: EVAL',
        '',
      ].join('\n');

      const result = extractCurrentMilestone(roadmap, tmpDir);

      assert.ok(
        result.includes('v8.0-B Overview (STARTED 2026-05-18)'),
        'should include active v8.0-B section'
      );
      assert.ok(
        result.includes('Phase 31: EVAL'),
        'should include Phase 31 row from active v8.0-B'
      );
      assert.ok(
        !result.includes('v8.0-F closed content here'),
        'should NOT include closed v8.0-F section body when active sibling exists'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('skips closed v8.0-F + v8.0-B (both CLOSED), returns active v8.0-C (STATE milestone: v8.0)', () => {
    const tmpDir = createTempProject('gsd-test-extract-prefix-');
    try {
      writeState(tmpDir, 'v8.0');
      const roadmap = [
        '# Project Roadmap',
        '',
        '## v8.0 Overview — v8.0-F (CLOSED FAIL 2026-05-18)',
        '- v8.0-F closed',
        '',
        '## v8.0-B Overview (CLOSED FAIL 2026-05-23)',
        '- v8.0-B closed',
        '',
        '## v8.0-C Overview (STARTED 2026-05-23)',
        '- v8.0-C active content here',
        '',
      ].join('\n');

      const result = extractCurrentMilestone(roadmap, tmpDir);

      assert.ok(
        result.includes('v8.0-C Overview (STARTED 2026-05-23)'),
        'should select active v8.0-C section over two closed predecessors'
      );
      assert.ok(
        !result.includes('v8.0-F closed'),
        'should NOT include closed v8.0-F'
      );
      assert.ok(
        !result.includes('v8.0-B closed'),
        'should NOT include closed v8.0-B'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('explicit milestone version (v8.0-C) matches only its own section, ignores siblings', () => {
    const tmpDir = createTempProject('gsd-test-extract-prefix-');
    try {
      writeState(tmpDir, 'v8.0-C');
      const roadmap = [
        '# Project Roadmap',
        '',
        '## v8.0 Overview — v8.0-F (CLOSED FAIL)',
        '- v8.0-F body',
        '',
        '## v8.0-B Overview (CLOSED FAIL)',
        '- v8.0-B body',
        '',
        '## v8.0-C Overview (STARTED)',
        '- v8.0-C body active',
        '',
      ].join('\n');

      const result = extractCurrentMilestone(roadmap, tmpDir);

      assert.ok(result.includes('v8.0-C body active'));
      assert.ok(!result.includes('v8.0-F body'));
      assert.ok(!result.includes('v8.0-B body'));
    } finally {
      cleanup(tmpDir);
    }
  });

  test('fallback to first match when every candidate is closed (legacy behavior)', () => {
    const tmpDir = createTempProject('gsd-test-extract-prefix-');
    try {
      writeState(tmpDir, 'v8.0');
      const roadmap = [
        '# Project Roadmap',
        '',
        '## v8.0 Overview — v8.0-F (CLOSED FAIL)',
        '- closed body 1',
        '',
        '## v8.0-B Overview (CLOSED FAIL)',
        '- closed body 2',
        '',
      ].join('\n');

      const result = extractCurrentMilestone(roadmap, tmpDir);

      // Both are closed — legacy first-match fallback returns the first one.
      assert.ok(
        result.includes('## v8.0 Overview — v8.0-F (CLOSED FAIL)'),
        'should fall back to first match when all candidates are closed'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('archived marker variations are recognized (ARCHIVED, ABANDONED, ✅, 🗄️)', () => {
    const variants = [
      '## v8.0 Overview — v8.0-F (ARCHIVED)',
      '## v8.0 Overview — v8.0-F (ABANDONED 2026-05-14)',
      '## ✅ v8.0 Overview — v8.0-F',
      '## 🗄️ v8.0 Overview — v8.0-F',
      '## v8.0 Overview — v8.0-F (SHIPPED)',
      '## v8.0 Overview — v8.0-F (FAILED)',
    ];
    for (const closedHeading of variants) {
      const tmpDir = createTempProject('gsd-test-extract-prefix-');
      try {
        writeState(tmpDir, 'v8.0');
        const roadmap = [
          '# Project Roadmap',
          '',
          closedHeading,
          '- closed body',
          '',
          '## v8.0-B Overview (STARTED)',
          '- active body content',
          '',
        ].join('\n');

        const result = extractCurrentMilestone(roadmap, tmpDir);

        assert.ok(
          result.includes('active body content'),
          `should skip closed marker "${closedHeading}" and select active v8.0-B`
        );
        assert.ok(
          !result.includes('- closed body'),
          `should NOT include closed body for marker "${closedHeading}"`
        );
      } finally {
        cleanup(tmpDir);
      }
    }
  });

  test('single milestone (no closed sibling) — no regression', () => {
    const tmpDir = createTempProject('gsd-test-extract-prefix-');
    try {
      writeState(tmpDir, 'v3.0');
      const roadmap = [
        '# Project Roadmap',
        '',
        '## v3.0 Initial Release (STARTED)',
        '- v3.0 active body',
        '',
        '### Phase 1: SETUP',
        '',
      ].join('\n');

      const result = extractCurrentMilestone(roadmap, tmpDir);

      assert.ok(result.includes('v3.0 active body'));
      assert.ok(result.includes('Phase 1: SETUP'));
    } finally {
      cleanup(tmpDir);
    }
  });
});
