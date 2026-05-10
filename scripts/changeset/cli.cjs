#!/usr/bin/env node
'use strict';

/**
 * CLI wrapper for the changeset-fragment workflow (#2975).
 *
 * Subcommands:
 *   render --repo <dir> --version V --date D [--json]   Fold .changeset/*.md
 *                                                       into CHANGELOG.md;
 *                                                       delete consumed fragments.
 *
 * `--json` emits a structured report on stdout — the only contract tests
 * assert against. Per CONTRIBUTING.md "Prohibited: Raw Text Matching on
 * Test Outputs", the human formatter is operator-only.
 */

const fs = require('node:fs');
const path = require('node:path');

const { parseFragment, FRAGMENT_ERROR } = require('./parse.cjs');
const { renderChangelog } = require('./render.cjs');
const { serializeChangelog } = require('./serialize.cjs');
const { renderGithubReleaseNotes } = require('./github-release-notes.cjs');

function parseArgs(argv) {
  const opts = {
    cmd: null,
    repo: process.cwd(),
    version: null,
    date: null,
    fromRef: null,
    toRef: null,
    output: null,
    repoSlug: 'gsd-build/get-shit-done',
    installCommand: 'npx get-shit-done-cc@latest',
    json: false,
  };
  if (argv.length === 0) return { ok: true, opts };
  opts.cmd = argv[0];

  // Pull a value for a value-taking flag, validating that the next token
  // exists and is not itself another flag (which is the silently-misparsed
  // case CR called out: e.g. `--repo --json` would consume `--json` as the
  // repo path).
  const requireValue = (flag, i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
      return { ok: false, error: `missing value for ${flag}` };
    }
    return { ok: true, value: v };
  };

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') { opts.json = true; continue; }
    if (
      a === '--repo' ||
      a === '--version' ||
      a === '--date' ||
      a === '--from' ||
      a === '--to' ||
      a === '--output' ||
      a === '--repo-slug' ||
      a === '--install-command'
    ) {
      const r = requireValue(a, i);
      if (!r.ok) return { ok: false, error: r.error };
      if (a === '--repo') opts.repo = r.value;
      else if (a === '--version') opts.version = r.value;
      else if (a === '--date') opts.date = r.value;
      else if (a === '--from') opts.fromRef = r.value;
      else if (a === '--to') opts.toRef = r.value;
      else if (a === '--output') opts.output = r.value;
      else if (a === '--repo-slug') opts.repoSlug = r.value;
      else if (a === '--install-command') opts.installCommand = r.value;
      i++;
      continue;
    }
    return { ok: false, error: `unknown argument: ${a}` };
  }
  return { ok: true, opts };
}

function listFragmentFiles(changesetDir) {
  if (!fs.existsSync(changesetDir)) return [];
  return fs.readdirSync(changesetDir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => path.join(changesetDir, f));
}

function splitChangelog(text) {
  // Split off the top-level "# Changelog" heading + lead matter (everything
  // before the first "## [version]" block) from the rest. The rest is the
  // priorChangelog passed into renderChangelog. The "## [Unreleased]" block,
  // if present, is dropped (the new release replaces it).
  const lines = text.split(/\r?\n/);
  const firstReleaseIdx = lines.findIndex((l) => /^##\s+\[/.test(l));
  if (firstReleaseIdx === -1) {
    return { lead: text.replace(/\s+$/, ''), prior: '' };
  }
  const lead = lines.slice(0, firstReleaseIdx).join('\n').replace(/\s+$/, '');
  let priorStart = firstReleaseIdx;
  // Skip the [Unreleased] block if present — it's a placeholder, not a release.
  if (/^##\s+\[Unreleased\]/i.test(lines[firstReleaseIdx])) {
    let j = firstReleaseIdx + 1;
    while (j < lines.length && !/^##\s+\[/.test(lines[j])) j++;
    priorStart = j;
  }
  const prior = lines.slice(priorStart).join('\n').trimStart();
  return { lead, prior };
}

function cmdRender(opts) {
  const repo = path.resolve(opts.repo);
  const changesetDir = path.join(repo, '.changeset');
  const changelogPath = path.join(repo, 'CHANGELOG.md');
  const fragmentFiles = listFragmentFiles(changesetDir);

  const fragments = [];
  const failures = [];
  for (const file of fragmentFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const r = parseFragment(src);
    if (r.ok) fragments.push({ ...r.fragment, file });
    else failures.push({ file: path.relative(repo, file), reason: r.reason, detail: r.detail || null });
  }

  if (failures.length > 0) {
    return { exitCode: 1, report: { consumed: 0, failures } };
  }
  if (fragments.length === 0) {
    return { exitCode: 0, report: { consumed: 0, failures: [] } };
  }

  const priorText = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '';
  const { lead, prior } = splitChangelog(priorText);

  const ir = renderChangelog({
    fragments,
    version: opts.version,
    date: opts.date,
    priorChangelog: prior || null,
  });
  const releaseBlock = serializeChangelog(ir);
  const out = [
    lead || '# Changelog',
    '',
    '## [Unreleased]',
    '',
    releaseBlock.replace(/\s+$/, ''),
    '',
  ].join('\n');

  fs.writeFileSync(changelogPath, out);

  // Delete consumed fragments. If any unlink fails the changelog is written
  // but the fragment is still on disk, so a re-run would double-consume it.
  // Surface the partial-failure as exitCode=1 with structured detail so the
  // operator can manually clean up before retrying.
  const deleteFailures = [];
  for (const f of fragments) {
    try {
      fs.unlinkSync(f.file);
    } catch (e) {
      deleteFailures.push({
        file: path.relative(repo, f.file),
        reason: 'fail_fragment_delete',
        detail: e.code || e.message,
      });
    }
  }

  return {
    exitCode: deleteFailures.length > 0 ? 1 : 0,
    report: {
      consumed: fragments.length - deleteFailures.length,
      failures: deleteFailures,
      release: { version: opts.version, date: opts.date },
    },
  };
}

function cmdGithubReleaseNotes(opts) {
  const repo = path.resolve(opts.repo);
  const report = renderGithubReleaseNotes({
    repo,
    fromRef: opts.fromRef,
    toRef: opts.toRef,
    repoSlug: opts.repoSlug,
    installCommand: opts.installCommand,
  });

  if (!report.ok) {
    return {
      exitCode: 1,
      report: {
        consumed: 0,
        failures: report.failures,
        release: { from: opts.fromRef, to: opts.toRef },
      },
    };
  }

  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), report.body);
  }

  return {
    exitCode: 0,
    report: {
      consumed: report.fragments.length,
      failures: [],
      release: { from: opts.fromRef, to: opts.toRef },
      output: opts.output || null,
      body: opts.output ? null : report.body,
    },
  };
}

function usage() {
  return [
    'usage:',
    '  changeset/cli.cjs render --repo <dir> --version V --date D [--json]',
    '  changeset/cli.cjs github-release-notes --repo <dir> --from REF --to REF [--output FILE] [--repo-slug OWNER/REPO] [--install-command CMD] [--json]',
    '',
  ].join('\n');
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error}\n`);
    process.stderr.write(usage());
    process.exit(2);
  }
  const { opts } = parsed;
  if (opts.cmd !== 'render' && opts.cmd !== 'github-release-notes') {
    process.stderr.write(usage());
    process.exit(2);
  }
  if (opts.cmd === 'render' && (!opts.version || !opts.date)) {
    process.stderr.write('--version and --date are required for render\n');
    process.exit(2);
  }
  if (opts.cmd === 'github-release-notes' && (!opts.fromRef || !opts.toRef)) {
    process.stderr.write('--from and --to are required for github-release-notes\n');
    process.exit(2);
  }

  const { exitCode, report } = opts.cmd === 'render' ? cmdRender(opts) : cmdGithubReleaseNotes(opts);
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (opts.cmd === 'github-release-notes' && report.body) {
    process.stdout.write(report.body);
  } else {
    process.stdout.write(`Consumed: ${report.consumed} fragment(s)\n`);
    if (report.failures.length > 0) {
      process.stdout.write(`Failures: ${report.failures.length}\n`);
      for (const f of report.failures) {
        process.stdout.write(`  ${f.file}: ${f.reason}${f.detail ? ` (${f.detail})` : ''}\n`);
      }
    }
  }
  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = { cmdRender, cmdGithubReleaseNotes, parseArgs, splitChangelog, listFragmentFiles, usage };
