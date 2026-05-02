'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { auditWorkflowScriptPaths, AUDIT_FINDING } = require(
  path.join(ROOT, 'scripts', 'audit-workflow-script-paths.cjs'),
);

// auditWorkflowScriptPaths is a pure function: it walks workflowsDir,
// extracts every ${GSD_HOME}/<path> script reference, and returns a
// structured report. Tests assert on the typed report — no regex on
// console output.

// #2996 CR: per-fixture repos are rooted under a single tmpRoot so the
// after()-hook actually cleans them up. The previous shape created tmpRoot
// in before() but never used it, leaking each fixture's mkdtempSync dir.
let tmpRoot;
function fixtureRepo({ workflows, files }) {
  // workflows: { 'foo.md': '...content with ${GSD_HOME}/...' }
  // files:     [ 'get-shit-done/bin/x.cjs', ... ]  — files to create in repo
  const repoRoot = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  const workflowsDir = path.join(repoRoot, 'get-shit-done', 'workflows');
  fs.mkdirSync(workflowsDir, { recursive: true });
  for (const [name, body] of Object.entries(workflows || {})) {
    fs.writeFileSync(path.join(workflowsDir, name), body);
  }
  for (const rel of files || []) {
    const full = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '');
  }
  return { repoRoot, workflowsDir };
}

before(() => { tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2995-')); });
after(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

describe('Bug #2995: post-install script-paths audit (#2995)', () => {
  test('AUDIT_FINDING enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(AUDIT_FINDING).sort(),
      ['MISSING_FROM_REPO', 'NOT_INSTALLED'].sort(),
    );
  });

  test('returns { ok: true, findings: [] } when workflow refs an existing, installed-path script', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'good.md': 'node "${GSD_HOME}/get-shit-done/bin/foo.cjs" --json\n',
      },
      files: ['get-shit-done/bin/foo.cjs'],
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done', 'commands', 'agents', 'hooks'],
    });
    assert.deepEqual(r, { ok: true, findings: [] });
  });
});

describe('Bug #2995: detection paths', () => {
  const { auditWorkflowScriptPaths, AUDIT_FINDING } = require(require('node:path').join(__dirname, '..', 'scripts', 'audit-workflow-script-paths.cjs'));

  test('reports MISSING_FROM_REPO when the referenced file does not exist in the repo', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'foo.md': 'node "${GSD_HOME}/get-shit-done/bin/typo.cjs" --json\n',
      },
      files: [],
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done'],
    });
    assert.equal(r.ok, false);
    assert.equal(r.findings.length, 1);
    assert.deepEqual(r.findings[0], {
      workflow: 'foo.md',
      path: 'get-shit-done/bin/typo.cjs',
      kind: AUDIT_FINDING.MISSING_FROM_REPO,
    });
  });

  test('reports NOT_INSTALLED when first path segment is outside installedPrefixes (the #2994 case)', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'foo.md': 'node "${GSD_HOME}/scripts/verify-reapply-patches.cjs"\n',
      },
      files: ['scripts/verify-reapply-patches.cjs'],  // file exists, but `scripts/` not in installed prefixes
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done', 'commands', 'agents', 'hooks'],
    });
    assert.equal(r.ok, false);
    assert.equal(r.findings.length, 1);
    assert.deepEqual(r.findings[0], {
      workflow: 'foo.md',
      path: 'scripts/verify-reapply-patches.cjs',
      kind: AUDIT_FINDING.NOT_INSTALLED,
    });
  });

  test('handles ${GSD_HOME:-$HOME/.claude}/... default-fallback syntax', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'a.md': 'node "${GSD_HOME:-$HOME/.claude}/get-shit-done/bin/x.cjs"\n',
      },
      files: ['get-shit-done/bin/x.cjs'],
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done'],
    });
    assert.deepEqual(r, { ok: true, findings: [] });
  });

  test('reports both findings when one workflow has multiple problems', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'multi.md': [
          'node "${GSD_HOME}/scripts/a.cjs"',
          'node "${GSD_HOME}/get-shit-done/bin/b.cjs"',
          'node "${GSD_HOME}/get-shit-done/bin/missing.cjs"',
        ].join('\n') + '\n',
      },
      files: ['scripts/a.cjs', 'get-shit-done/bin/b.cjs'],
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done'],
    });
    assert.equal(r.ok, false);
    assert.equal(r.findings.length, 2);
    const kinds = r.findings.map((f) => f.kind).sort();
    assert.deepEqual(kinds, [AUDIT_FINDING.MISSING_FROM_REPO, AUDIT_FINDING.NOT_INSTALLED]);
  });

  test('extracts no findings from a workflow without GSD_HOME script refs', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'plain.md': '# A workflow\n\nSome prose, no script refs.\n',
      },
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done'],
    });
    assert.deepEqual(r, { ok: true, findings: [] });
  });
});

describe('Bug #2995: real workflow audit', () => {
  const { auditWorkflowScriptPaths, AUDIT_FINDING } = require(require('node:path').join(__dirname, '..', 'scripts', 'audit-workflow-script-paths.cjs'));

  // The set of top-level directories the installer (bin/install.js) actually
  // copies into ${configDir}/. Touching this set requires updating both
  // bin/install.js AND this constant — the parity is intentional.
  const INSTALLED_PREFIXES = [
    'get-shit-done',  // workflows, references, bin/lib, templates
    'commands',       // commands/gsd/*.md (Claude Code local + Gemini global)
    'skills',         // skills/gsd-*/SKILL.md (Claude Code 2.1.88+ global, Codex, etc.)
    'agents',         // agents/gsd-*.md
    'hooks',          // hooks/gsd-*.{sh,js}
  ];

  // Known existing gaps tracked in their own issues. Removing an entry should
  // land in the same PR that fixes the underlying issue; CI surfaces any NEW
  // gap as a hard failure.
  // (#2994 entry removed: this PR moves verify-reapply-patches.cjs to
  // get-shit-done/bin/ which IS an installed prefix, closing the gap.)
  const KNOWN_GAPS = new Set();

  test('no NEW workflow refs fail to resolve at the deployed path (KNOWN_GAPS allow-listed)', () => {
    const r = auditWorkflowScriptPaths({
      workflowsDir: require('node:path').join(ROOT, 'get-shit-done', 'workflows'),
      repoRoot: ROOT,
      installedPrefixes: INSTALLED_PREFIXES,
    });
    const newGaps = r.findings.filter(
      (f) => !KNOWN_GAPS.has(`${f.workflow}|${f.path}|${f.kind}`),
    );
    if (newGaps.length > 0) {
      const summary = newGaps.map(
        (f) => `  ${f.workflow}: ${f.path} (${f.kind})`,
      ).join('\n');
      assert.fail(
        `New workflow ref does not resolve at the deployed path:\n${summary}\n\n` +
        `Either move the script under one of [${INSTALLED_PREFIXES.join(', ')}], ` +
        `update bin/install.js to copy the new top-level directory, or ` +
        `(if intentionally tracked) add an entry to KNOWN_GAPS with the issue reference.`,
      );
    }
  });

  // #2996 CR: a reference that is both outside an installed prefix AND
  // missing from the repo must emit BOTH findings in one run. Previously
  // the code short-circuited on NOT_INSTALLED, hiding MISSING_FROM_REPO
  // until the developer fixed the prefix and re-ran CI.
  test('a reference that is both not-installed AND missing-from-repo emits both findings (no short-circuit)', () => {
    const { repoRoot, workflowsDir } = fixtureRepo({
      workflows: {
        'foo.md': '```bash\nnode "${GSD_HOME}/scripts/missing.cjs"\n```\n',
      },
      // Note: scripts/missing.cjs intentionally NOT created in the repo.
    });
    const r = auditWorkflowScriptPaths({
      workflowsDir,
      repoRoot,
      installedPrefixes: ['get-shit-done', 'agents', 'hooks', 'commands'],
    });
    assert.equal(r.ok, false);
    const kinds = r.findings.filter((f) => f.path === 'scripts/missing.cjs').map((f) => f.kind).sort();
    assert.deepEqual(
      kinds,
      [AUDIT_FINDING.MISSING_FROM_REPO, AUDIT_FINDING.NOT_INSTALLED].sort(),
      'expected both NOT_INSTALLED and MISSING_FROM_REPO findings for the same ref',
    );
  });

  test('KNOWN_GAPS entries still match real findings — fixed gaps must be removed from the allow-list', () => {
    const r = auditWorkflowScriptPaths({
      workflowsDir: require('node:path').join(ROOT, 'get-shit-done', 'workflows'),
      repoRoot: ROOT,
      installedPrefixes: INSTALLED_PREFIXES,
    });
    const realKeys = new Set(r.findings.map((f) => `${f.workflow}|${f.path}|${f.kind}`));
    const stale = [...KNOWN_GAPS].filter((k) => !realKeys.has(k));
    assert.deepEqual(
      stale,
      [],
      `KNOWN_GAPS contains entries not present in audit findings — remove these: ${stale.join(', ')}`,
    );
  });
});
