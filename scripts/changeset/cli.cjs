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

function parseArgs(argv) {
  const opts = { cmd: null, repo: process.cwd(), version: null, date: null, json: false };
  if (argv.length === 0) return opts;
  opts.cmd = argv[0];
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--version') opts.version = argv[++i];
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--json') opts.json = true;
  }
  return opts;
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
  for (const f of fragments) fs.unlinkSync(f.file);

  return {
    exitCode: 0,
    report: {
      consumed: fragments.length,
      failures: [],
      release: { version: opts.version, date: opts.date },
    },
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.cmd !== 'render') {
    process.stderr.write('usage: changeset/cli.cjs render --repo <dir> --version V --date D [--json]\n');
    process.exit(2);
  }
  if (!opts.version || !opts.date) {
    process.stderr.write('--version and --date are required for render\n');
    process.exit(2);
  }

  const { exitCode, report } = cmdRender(opts);
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
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

module.exports = { cmdRender, splitChangelog, listFragmentFiles };
