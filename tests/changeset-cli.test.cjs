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
