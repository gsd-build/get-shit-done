/**
 * Bug #3687: gsd-phase accepts only --insert, but stale docs/agents still suggest insert forms
 *
 * Two stale-text patterns remained in current main even after the broader
 * #2950 cleanup:
 *
 *   1. `get-shit-done/workflows/insert-phase.md` still showed
 *      `/gsd-insert-phase <after> <description>` examples — a command that
 *      no longer exists (consolidated into `/gsd:phase --insert` by #2790).
 *
 *   2. `agents/gsd-roadmapper.md` said decimal phases are
 *      "Created via `/gsd:phase insert`" — the bare `insert` token form,
 *      which `commands/gsd/phase.md` does NOT route on. Only the leading
 *      `--insert` flag is honored, so this doc form silently falls through
 *      to the add-phase route and creates a wrong roadmap phase.
 *
 * Fix: rewrite both files to use the canonical `/gsd:phase --insert` form
 * and lock in coverage so the strings can't drift back.
 *
 * docs/FEATURES.md:2644 is intentionally excluded — REQ-CONSOLIDATE-03
 * documents the deleted command names as part of the deprecation contract.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf-8');
}

function* walkMarkdown(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield full;
    }
  }
}

describe('bug #3687: stale insert-phase command forms in docs/agents', () => {
  test('workflows/insert-phase.md uses /gsd:phase --insert, not /gsd-insert-phase', () => {
    const body = read('get-shit-done/workflows/insert-phase.md');
    assert.ok(
      !/\/gsd-insert-phase\b/.test(body),
      'insert-phase.md still references the retired /gsd-insert-phase command',
    );
    assert.ok(
      /\/gsd:phase --insert\b/.test(body),
      'insert-phase.md should document the canonical /gsd:phase --insert form',
    );
  });

  test('agents/gsd-roadmapper.md uses /gsd:phase --insert, not bare "/gsd:phase insert"', () => {
    const body = read('agents/gsd-roadmapper.md');
    assert.ok(
      !/\/gsd:phase insert\b/.test(body),
      'gsd-roadmapper.md uses the bare "insert" token form, which commands/gsd/phase.md does not route on',
    );
    assert.ok(
      /\/gsd:phase --insert\b/.test(body),
      'gsd-roadmapper.md should document the canonical /gsd:phase --insert form',
    );
  });

  test('no workflow or agent markdown emits the retired /gsd-insert-phase command', () => {
    const offenders = [];
    for (const dir of [
      path.join(REPO_ROOT, 'get-shit-done', 'workflows'),
      path.join(REPO_ROOT, 'agents'),
    ]) {
      for (const file of walkMarkdown(dir)) {
        const body = fs.readFileSync(file, 'utf-8');
        if (/\/gsd-insert-phase\b/.test(body)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Files still emit retired /gsd-insert-phase: ${offenders.join(', ')}`,
    );
  });

  test('no workflow or agent markdown emits bare "/gsd:phase insert" (the unrouted form)', () => {
    const offenders = [];
    for (const dir of [
      path.join(REPO_ROOT, 'get-shit-done', 'workflows'),
      path.join(REPO_ROOT, 'agents'),
    ]) {
      for (const file of walkMarkdown(dir)) {
        const body = fs.readFileSync(file, 'utf-8');
        if (/\/gsd:phase insert\b/.test(body)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Files still emit unrouted /gsd:phase insert form: ${offenders.join(', ')}`,
    );
  });
});
