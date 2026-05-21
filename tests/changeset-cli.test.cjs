'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'changeset', 'cli.cjs');
const { parseChangelog } = require(path.join(ROOT, 'scripts', 'changeset', 'serialize.cjs'));

let tmp;

function writeFragment(name, type, pr, body) {
  fs.mkdirSync(path.join(tmp, '.changeset'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.changeset', `${name}.md`),
    `---\ntype: ${type}\npr: ${pr}\n---\n${body}\n`,
  );
}

function runRender(args = []) {
  const r = cp.spawnSync(
    process.execPath,
    [SCRIPT, 'render', '--repo', tmp, ...args, '--json'],
    { encoding: 'utf8' },
  );
  return {
    status: r.status,
    report: r.stdout && r.stdout.length ? JSON.parse(r.stdout) : null,
    stderr: r.stderr || '',
  };
}

before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-changeset-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

// Fixtures for extract tests (#3496)
// Written as arrays to avoid template-literal indentation injecting
// leading spaces that would break the ^## regex anchor.
const EXTRACT_CHANGELOG = [
  '# Changelog',
  '',
  '## [1.5.15] - 2026-01-20',
  '',
  '### Added',
  '',
  '- Feature X. (#200)',
  '',
  '## [1.5.14] - 2026-01-18',
  '',
  '### Fixed',
  '',
  '- Single-line fix. (#101)',
  '- **Multi-line fix** — first line of a long',
  '  description that spans two lines. (#102)',
  '',
  '## [1.5.13] - 2026-01-15',
  '',
  '### Fixed',
  '',
  '- Old fix. (#100)',
  '',
  '## [1.5.10] - 2026-01-01',
  '',
  '### Fixed',
  '',
  '- Very old fix. (#50)',
].join('\n');

function runExtract(args = [], changelogText = null) {
  const changelogFile = path.join(tmp, 'CHANGELOG-extract-test.md');
  if (changelogText !== null) {
    fs.writeFileSync(changelogFile, changelogText);
  }
  const r = cp.spawnSync(
    process.execPath,
    [SCRIPT, 'extract', '--changelog', changelogFile, ...args],
    { encoding: 'utf8' },
  );
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    json: (() => {
      try { return JSON.parse(r.stdout); } catch { return null; }
    })(),
  };
}

describe('changeset cli extract: version-range changelog extraction (#3496)', () => {
  test('exits 2 with no output when no versions fall in range', (t) => {
    const r = runExtract(['--from', '1.5.15', '--to', '1.5.15', '--json'], EXTRACT_CHANGELOG);
    assert.equal(r.status, 2, `expected exit 2 for empty range, stderr=${r.stderr}`);
  });

  test('extracts versions strictly after from and up to and including to', (t) => {
    const r = runExtract(['--from', '1.5.13', '--to', '1.5.15', '--json'], EXTRACT_CHANGELOG);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.ok(r.json, 'stdout must be valid JSON');
    const versions = r.json.releases.map((rel) => rel.version);
    assert.ok(versions.includes('1.5.15'), '1.5.15 must be in range (inclusive to)');
    assert.ok(versions.includes('1.5.14'), '1.5.14 must be in range (between from and to)');
    assert.ok(!versions.includes('1.5.13'), '1.5.13 must NOT be in range (exclusive from)');
    assert.ok(!versions.includes('1.5.10'), '1.5.10 must NOT be in range (below from)');
  });

  test('accepts v-prefixed version arguments', (t) => {
    const r = runExtract(['--from', 'v1.5.13', '--to', 'v1.5.15', '--json'], EXTRACT_CHANGELOG);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.ok(r.json, 'stdout must be valid JSON');
    const versions = r.json.releases.map((rel) => rel.version);
    assert.ok(versions.includes('1.5.15'));
    assert.ok(versions.includes('1.5.14'));
    assert.ok(!versions.includes('1.5.13'));
  });

  test('captures multi-line bullets in extracted range', (t) => {
    const r = runExtract(['--from', '1.5.13', '--to', '1.5.14', '--json'], EXTRACT_CHANGELOG);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const release = r.json.releases.find((rel) => rel.version === '1.5.14');
    assert.ok(release, '1.5.14 must be in result');
    const prs = release.sections.flatMap((s) => s.bullets.map((b) => b.pr));
    assert.ok(prs.includes(101), 'single-line bullet pr=101 must be captured');
    assert.ok(prs.includes(102), 'multi-line bullet pr=102 must be captured');
  });

  test('emits markdown text (non-JSON) when --json is not passed', (t) => {
    // Without --json the output is human-readable markdown, not JSON.
    // Assert on structural facts derivable from the text: exactly the two
    // matched releases appear as ## headers, using parseChangelog so we
    // assert on version strings via the production parser rather than
    // raw substring matches.
    const { parseChangelog: _pc } = require(path.join(ROOT, 'scripts', 'changeset', 'serialize.cjs'));
    const r = runExtract(['--from', '1.5.13', '--to', '1.5.15'], EXTRACT_CHANGELOG);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.ok(r.stdout.trim().length > 0, 'stdout must be non-empty');
    const parsed = _pc(r.stdout);
    const versions = parsed.releases.map((rel) => rel.version);
    assert.ok(versions.includes('1.5.15'), '1.5.15 in markdown output');
    assert.ok(versions.includes('1.5.14'), '1.5.14 in markdown output');
    assert.ok(!versions.includes('1.5.13'), '1.5.13 must not appear in output (excluded by --from)');
  });

  test('missing --from or --to emits usage and exits non-zero', (t) => {
    const r = runExtract(['--from', '1.0.0'], EXTRACT_CHANGELOG);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.length > 0 || r.stdout.length > 0, 'must emit usage text');
  });
});

describe('changeset cli render: file-I/O wrapper (#2975)', () => {
  test('exits 0 with consumed=N when N fragments are folded into CHANGELOG.md and deleted', () => {
    fs.rmSync(path.join(tmp, '.changeset'), { recursive: true, force: true });
    fs.writeFileSync(
      path.join(tmp, 'CHANGELOG.md'),
      '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n### Fixed\n\n- prior fix (#1)\n',
    );
    writeFragment('aaa-bbb-ccc', 'Fixed', 100, 'fragment-driven fix.');
    writeFragment('ddd-eee-fff', 'Added', 101, 'fragment-driven feature.');

    const r = runRender(['--version', '1.1.0', '--date', '2026-05-01']);
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.equal(r.report.consumed, 2);
    assert.equal(r.report.failures.length, 0);

    // Round-trip: parsing the resulting CHANGELOG must reflect the new release
    // and preserve the prior one.
    const text = fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8');
    const parsed = parseChangelog(text);
    const v110 = parsed.releases.find((r) => r.version === '1.1.0');
    assert.ok(v110, 'new 1.1.0 release present');
    assert.deepEqual(
      v110.sections.map((s) => ({ type: s.type, prs: s.bullets.map((b) => b.pr) })),
      [{ type: 'Added', prs: [101] }, { type: 'Fixed', prs: [100] }],
    );
    const v100 = parsed.releases.find((r) => r.version === '1.0.0');
    assert.ok(v100, 'prior 1.0.0 release preserved');
    assert.equal(v100.sections[0].bullets[0].pr, 1);

    // Fragments deleted after consumption.
    const remaining = fs.readdirSync(path.join(tmp, '.changeset'));
    assert.deepEqual(remaining.filter((f) => f.endsWith('.md')), []);
  });
});
