/**
 * Regression guard for #2636 — `gsd-sdk query agent-skills <slug>` calls in
 * workflows must NOT silently swallow failures via a bare `2>/dev/null`.
 *
 * Root cause of #2636: when the installed npm `@gsd-build/sdk` was stale and
 * the `agent-skills` handler was missing, every workflow line of the form
 *   AGENT_SKILLS_X=$(gsd-sdk query agent-skills <slug> 2>/dev/null)
 * resolved to empty string, and the `agent_skills.<slug>` config was never
 * injected into spawn prompts. No error ever surfaced.
 *
 * Fix: remove `2>/dev/null` from `agent-skills` calls so any SDK failure
 * (stale binary, unregistered handler, runtime error) prints to the
 * workflow's stderr and is visible to the user.
 *
 * Test scope: ONLY `gsd-sdk query agent-skills …` (the exact noun implicated
 * in #2636). Other `gsd-sdk query config-get …` patterns commonly use
 * `2>/dev/null || echo "default"` which IS exit-code aware (the `||` branch
 * only runs on non-zero exit) and is a documented fallback pattern.
 *
 * Scans:  get-shit-done/workflows/**\/*.md  and  commands/**\/*.md
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'get-shit-done', 'workflows'),
  path.join(REPO_ROOT, 'commands'),
  path.join(REPO_ROOT, 'agents'),
];

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
}

describe('bug #2636 — agent-skills query must not silently swallow failures', () => {
  test('no `gsd-sdk query agent-skills ... 2>/dev/null` in workflows', () => {
    const files = [];
    for (const root of SCAN_ROOTS) walk(root, files);
    assert.ok(files.length > 0, 'expected to scan some workflow/command files');

    // Match `gsd-sdk query agent-skills <slug>` followed (on the same line)
    // by `2>/dev/null` — the silent-swallow anti-pattern.
    const ANTI = /gsd-sdk\s+query\s+agent-skills\b[^\n]*2>\/dev\/null/;

    const offenders = [];
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (ANTI.test(lines[i])) {
          offenders.push(path.relative(REPO_ROOT, file) + ':' + (i + 1) + ': ' + lines[i].trim());
        }
      }
    }

    assert.strictEqual(
      offenders.length, 0,
      'Found `gsd-sdk query agent-skills ... 2>/dev/null` (silent swallow — ' +
      'root cause of #2636). Remove `2>/dev/null` so SDK failures surface.\n\n' +
      offenders.join('\n'),
    );
  });
});
