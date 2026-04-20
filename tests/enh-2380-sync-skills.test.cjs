'use strict';

/**
 * Tests for #2380 — /gsd-sync-skills cross-runtime skill sync.
 *
 * Verifies:
 * 1. install.js --skills-root <runtime> resolves correct paths
 * 2. sync-skills.md workflow covers required behavioral specs
 * 3. commands/gsd/sync-skills.md slash command exists
 * 4. INVENTORY in sync
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');

const INSTALL_JS = path.join(__dirname, '../bin/install.js');
const WORKFLOW = path.join(__dirname, '../get-shit-done/workflows/sync-skills.md');
const COMMAND = path.join(__dirname, '../commands/gsd/sync-skills.md');

function readWorkflow() {
  return fs.readFileSync(WORKFLOW, 'utf-8');
}

// ── install.js --skills-root ──────────────────────────────────────────────────

describe('install.js --skills-root', () => {
  const CASES = [
    { runtime: 'claude', expected: path.join(os.homedir(), '.claude', 'skills') },
    { runtime: 'codex', expected: path.join(os.homedir(), '.codex', 'skills') },
    { runtime: 'copilot', expected: path.join(os.homedir(), '.copilot', 'skills') },
    { runtime: 'cursor', expected: path.join(os.homedir(), '.cursor', 'skills') },
    { runtime: 'gemini', expected: path.join(os.homedir(), '.gemini', 'skills') },
  ];

  for (const { runtime, expected } of CASES) {
    test(`resolves correct skills root for ${runtime}`, () => {
      const result = spawnSync(process.execPath, [INSTALL_JS, '--skills-root', runtime], {
        encoding: 'utf-8',
        env: { ...process.env, GSD_TEST_MODE: undefined }, // ensure not in test mode
      });
      // Strip trailing newline
      const actual = result.stdout.trim();
      assert.strictEqual(actual, expected, `Expected ${expected}, got ${actual}`);
    });
  }

  test('exits non-zero when runtime arg is missing', () => {
    const result = spawnSync(process.execPath, [INSTALL_JS, '--skills-root'], {
      encoding: 'utf-8',
    });
    assert.notStrictEqual(result.status, 0, 'Should exit with error when runtime arg is missing');
  });

  test('returns a path ending in /skills', () => {
    const result = spawnSync(process.execPath, [INSTALL_JS, '--skills-root', 'windsurf'], {
      encoding: 'utf-8',
    });
    assert.ok(result.stdout.trim().endsWith('skills'), 'Skills root must end in /skills');
  });
});

// ── sync-skills.md workflow content ──────────────────────────────────────────

describe('sync-skills.md — required behavioral specs', () => {
  let content;

  test('workflow file exists', () => {
    content = readWorkflow();
    assert.ok(content.length > 0, 'sync-skills.md must exist and be non-empty');
  });

  test('--dry-run is the default (no writes without --apply)', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('dry-run') && (content.includes('default') || content.includes('Default')),
      'workflow must document --dry-run as default'
    );
  });

  test('--apply flag is required to execute writes', () => {
    content = content || readWorkflow();
    assert.ok(content.includes('--apply'), 'workflow must document --apply flag');
  });

  test('--from flag documented', () => {
    content = content || readWorkflow();
    assert.ok(content.includes('--from'), 'workflow must document --from flag');
  });

  test('--to flag documented (runtime|all)', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('--to') && content.includes('all'),
      'workflow must document --to flag with "all" option'
    );
  });

  test('only gsd-* directories are touched (non-GSD preservation)', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('gsd-*') && (content.includes('non-GSD') || content.includes('Non-GSD') || content.includes('not starting with')),
      'workflow must document that only gsd-* dirs are modified'
    );
  });

  test('idempotency documented (second apply = zero changes)', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('dempoten') || content.includes('Idempoten') || content.includes('zero changes') || content.includes('second run'),
      'workflow must document idempotency'
    );
  });

  test('install.js --skills-root is used for path resolution', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('--skills-root'),
      'workflow must reference install.js --skills-root for path resolution'
    );
  });

  test('diff report format: CREATE / UPDATE / REMOVE documented', () => {
    content = content || readWorkflow();
    assert.ok(content.includes('CREATE'), 'workflow must document CREATE in diff report');
    assert.ok(content.includes('UPDATE'), 'workflow must document UPDATE in diff report');
    assert.ok(content.includes('REMOVE'), 'workflow must document REMOVE in diff report');
  });

  test('source-not-found error guidance documented', () => {
    content = content || readWorkflow();
    assert.ok(
      content.includes('source skills root not found') || content.includes('source root') || content.includes('not found'),
      'workflow must document error when source skills root is missing'
    );
  });

  test('safety rule: dry-run performs no writes', () => {
    content = content || readWorkflow();
    const safetySection = content.includes('Safety Rules') || content.includes('safety');
    assert.ok(
      safetySection || content.includes('no writes') || content.includes('--dry-run performs no writes'),
      'workflow must have a safety rule that dry-run performs no writes'
    );
  });
});

// ── commands/gsd/sync-skills.md ───────────────────────────────────────────────

describe('commands/gsd/sync-skills.md', () => {
  test('slash command file exists', () => {
    assert.ok(fs.existsSync(COMMAND), 'commands/gsd/sync-skills.md must exist');
  });

  test('has valid frontmatter name field', () => {
    const content = fs.readFileSync(COMMAND, 'utf-8');
    assert.ok(
      content.includes('name: gsd:sync-skills'),
      'command must have name: gsd:sync-skills in frontmatter'
    );
  });
});

// ── INVENTORY sync ────────────────────────────────────────────────────────────

describe('INVENTORY sync', () => {
  test('INVENTORY.md lists /gsd-sync-skills command', () => {
    const inventory = fs.readFileSync(path.join(__dirname, '../docs/INVENTORY.md'), 'utf-8');
    assert.ok(inventory.includes('/gsd-sync-skills'), 'INVENTORY.md must list /gsd-sync-skills');
  });

  test('INVENTORY.md lists sync-skills.md workflow', () => {
    const inventory = fs.readFileSync(path.join(__dirname, '../docs/INVENTORY.md'), 'utf-8');
    assert.ok(inventory.includes('sync-skills.md'), 'INVENTORY.md must list sync-skills.md workflow');
  });

  test('INVENTORY-MANIFEST.json includes /gsd-sync-skills', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../docs/INVENTORY-MANIFEST.json'), 'utf-8')
    );
    assert.ok(
      manifest.families.commands.includes('/gsd-sync-skills'),
      'INVENTORY-MANIFEST.json must include /gsd-sync-skills in commands'
    );
  });

  test('INVENTORY-MANIFEST.json includes sync-skills.md', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../docs/INVENTORY-MANIFEST.json'), 'utf-8')
    );
    assert.ok(
      manifest.families.workflows.includes('sync-skills.md'),
      'INVENTORY-MANIFEST.json must include sync-skills.md in workflows'
    );
  });
});
