'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'changeset', 'cli.cjs');
const {
  loadFragmentsFromRange,
  buildGithubReleaseNotesIr,
  serializeGithubReleaseNotes,
  renderGithubReleaseNotes,
} = require(path.join(ROOT, 'scripts', 'changeset', 'github-release-notes.cjs'));

function run(command, args, cwd) {
  const result = cp.spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result.stdout;
}

function writeFragment(repo, name, type, pr, body) {
  const dir = path.join(repo, '.changeset');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.md`), `---\ntype: ${type}\npr: ${pr}\n---\n${body}\n`);
}

function createTaggedRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-release-notes-'));
  run('git', ['init', '-q'], repo);
  run('git', ['config', 'user.email', 'test@example.com'], repo);
  run('git', ['config', 'user.name', 'Test User'], repo);
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  run('git', ['add', 'README.md'], repo);
  run('git', ['commit', '-q', '-m', 'initial'], repo);
  run('git', ['tag', 'v1.0.0'], repo);

  writeFragment(repo, 'fix-install-sdk', 'Fixed', 101, '**`gsd-sdk` now installs reliably** — persistent PATH is checked.');
  writeFragment(repo, 'remove-intel-noise', 'Removed', 102, '**`gsd-intel-updater` no longer emits layout detection noise** — ordinary projects stay quiet.');
  run('git', ['add', '.changeset'], repo);
  run('git', ['commit', '-q', '-m', 'add changesets'], repo);
  run('git', ['tag', 'v1.0.1'], repo);
  return repo;
}

describe('changeset github release notes: tag-range renderer (#3382)', () => {
  test('loads changed changeset slugs from a git tag range', () => {
    const repo = createTaggedRepo();
    const result = loadFragmentsFromRange({ repo, fromRef: 'v1.0.0', toRef: 'v1.0.1' });

    assert.deepEqual(result.failures, []);
    assert.deepEqual(
      result.fragments.map((fragment) => ({ slug: fragment.slug, type: fragment.type, pr: fragment.pr })),
      [
        { slug: 'fix-install-sdk', type: 'Fixed', pr: 101 },
        { slug: 'remove-intel-noise', type: 'Removed', pr: 102 },
      ],
    );
  });

  test('builds grouped GitHub release-note IR from parsed fragments', () => {
    const repo = createTaggedRepo();
    const { fragments } = loadFragmentsFromRange({ repo, fromRef: 'v1.0.0', toRef: 'v1.0.1' });
    const ir = buildGithubReleaseNotesIr({ fragments });

    assert.deepEqual(
      ir.sections.map((section) => ({
        type: section.type,
        groups: section.groups.map((group) => ({ title: group.title, prs: group.bullets.map((b) => b.pr) })),
      })),
      [
        { type: 'Fixed', groups: [{ title: 'Install & runtime conversion', prs: [101] }] },
        { type: 'Removed', groups: [{ title: 'Intel updater', prs: [102] }] },
      ],
    );
  });

  test('CLI writes a notes file suitable for gh release edit --notes-file', () => {
    const repo = createTaggedRepo();
    const output = path.join(repo, 'release-notes.md');
    const result = cp.spawnSync(
      process.execPath,
      [
        SCRIPT,
        'github-release-notes',
        '--repo', repo,
        '--from', 'v1.0.0',
        '--to', 'v1.0.1',
        '--repo-slug', 'example/project',
        '--output', output,
        '--json',
      ],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(
      { consumed: report.consumed, output: report.output, hasBodyInJson: report.body !== null },
      { consumed: 2, output, hasBodyInJson: false },
    );

    const generated = renderGithubReleaseNotes({
      repo,
      fromRef: 'v1.0.0',
      toRef: 'v1.0.1',
      repoSlug: 'example/project',
      installCommand: 'npx get-shit-done-cc@latest',
    });
    assert.equal(fs.readFileSync(output, 'utf8'), generated.body);
  });

  test('rejects unsafe git refs before rendering a range', () => {
    const repo = createTaggedRepo();
    assert.throws(
      () => loadFragmentsFromRange({ repo, fromRef: '--help', toRef: 'v1.0.1' }),
      /Invalid git ref/,
    );
  });

  test('validates PR metadata and repo slug before serializing release notes', () => {
    assert.throws(
      () => serializeGithubReleaseNotes({
        ir: {
          sections: [
            {
              type: 'Fixed',
              groups: [{ title: 'Other fixes', bullets: [{ slug: 'missing-pr', body: 'missing pr' }] }],
            },
          ],
        },
        fromRef: 'v1.0.0',
        toRef: 'v1.0.1',
      }),
      /missing valid pr field/,
    );

    assert.throws(
      () => serializeGithubReleaseNotes({
        ir: { sections: [] },
        fromRef: 'v1.0.0',
        toRef: 'v1.0.1',
        repoSlug: 'owner/repo/extra',
      }),
      /Invalid repoSlug format/,
    );

    assert.throws(
      () => serializeGithubReleaseNotes({
        ir: { sections: [] },
        fromRef: 'v1.0.0',
        toRef: 'v1.0.1',
        installCommand: 'echo `bad`',
      }),
      /installCommand cannot contain backtick/,
    );
  });
});
