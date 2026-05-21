/**
 * Phase router invariants for source docs.
 *
 * `commands/gsd/phase.md` routes on a leading flag (`--insert`, `--remove`,
 * `--edit`) and falls through a catch-all default that passes `$ARGUMENTS`
 * straight to add-phase as a description. Any first token that is not a
 * `--flag` is therefore silently treated as a new-phase title.
 *
 * That catch-all turns **bare-token forms** in docs — e.g.
 * `/gsd:phase insert 1 Fix Critical Bug` — into roadmap corruption: the
 * router creates an integer phase titled with the literal verb instead of
 * the intended decimal insertion / removal / edit. Originating bug: #3687
 * (`agents/gsd-roadmapper.md` documented decimal phases as "Created via
 * `/gsd:phase insert`", which agents reading their own prompts would emit
 * verbatim).
 *
 * This file enforces a structural invariant: in `agents/`, `commands/gsd/`,
 * and `get-shit-done/workflows/`, every `/gsd:phase ` or `/gsd-phase `
 * reference that has a following token must be followed by either
 *
 *   - a `--flag` (which the router branches on), or
 *   - a description-shaped token (`"`, `'`, backtick, `<`, `[`, an uppercase
 *     letter, or a digit).
 *
 * Bare lowercase identifiers fail the test regardless of whether the
 * specific verb (`insert`, `remove`, `edit`, etc.) was on a known-bad list
 * — the check is by shape, not by string.
 *
 * `docs/FEATURES.md` is excluded by virtue of not being under the scanned
 * directories; the deprecation contract there names retired commands
 * intentionally.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');

const SCAN_DIRS = [
  path.join(REPO_ROOT, 'agents'),
  path.join(REPO_ROOT, 'commands', 'gsd'),
  path.join(REPO_ROOT, 'get-shit-done', 'workflows'),
];

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

function scanAll() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of walkMarkdown(dir)) files.push(f);
  }
  return files;
}

function rel(p) {
  return path.relative(REPO_ROOT, p);
}

describe('docs/phase-router invariants', () => {
  test('no doc emits a bare-token form after /gsd:phase or /gsd-phase', () => {
    // Match `/gsd:phase` or `/gsd-phase` followed by whitespace and a
    // lowercase identifier as the first non-whitespace token. Such a
    // token does not start with `--`, so commands/gsd/phase.md's first-
    // token check falls through to the add-phase default.
    //
    // Allowed forms (NOT matched by this regex):
    //   - /gsd:phase --insert ...        → starts with `--`
    //   - /gsd:phase "Add admin dashboard" → starts with `"`
    //   - /gsd:phase `description`       → starts with backtick
    //   - /gsd:phase <description>       → starts with `<`
    //   - /gsd:phase Add admin dashboard → starts with uppercase letter
    //   - /gsd:phase 1.2 placeholder     → starts with digit
    //   - /gsd:phase                     → no following token on the line
    const pattern = /\/gsd[:-]phase\s+([a-z][a-z0-9-]*)\b/g;

    const offenders = [];
    for (const file of scanAll()) {
      const body = fs.readFileSync(file, 'utf-8');
      for (const m of body.matchAll(pattern)) {
        offenders.push({
          file: rel(file),
          token: m[1],
          context: m[0],
        });
      }
    }

    assert.deepEqual(
      offenders,
      [],
      [
        'Bare-token forms after /gsd:phase appear in scanned docs.',
        'commands/gsd/phase.md only routes on leading --flags; any other',
        'first token silently falls through to add-phase and creates a',
        'wrong roadmap entry. Use --insert / --remove / --edit, or wrap',
        'descriptions in quotes / backticks / angle brackets / a leading',
        'uppercase letter.',
        '',
        'Offending forms:',
        ...offenders.map((o) => `  - ${o.file}: "${o.context}" → bare verb "${o.token}"`),
      ].join('\n'),
    );
  });
});
