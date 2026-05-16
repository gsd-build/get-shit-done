#!/usr/bin/env node
'use strict';

/**
 * Docs-required lint (#3213).
 *
 * Mirrors scripts/changeset/lint.cjs. Pure verdict function
 * evaluateLint({ changedFiles, fragments, labels }) returns
 * { ok, reason, triggering } using the LINT_REASON enum. The CLI wrapper
 * reads the PR diff (`git diff --name-only origin/${base}...HEAD`), parses
 * each touched `.changeset/*.md` fragment, then calls evaluateLint.
 *
 * Tests assert on the structured verdict, never on free text.
 */

const { parseFragment } = require('./changeset/parse.cjs');

const LINT_REASON = Object.freeze({
  OK_NO_TRIGGERING_FRAGMENTS: 'ok_no_triggering_fragments',
  OK_DOCS_UPDATED: 'ok_docs_updated',
  OK_OPT_OUT_LABEL: 'ok_opt_out_label',
  OK_FRAGMENTS_EXEMPT: 'ok_fragments_exempt',
  FAIL_DOCS_MISSING: 'fail_docs_missing',
});

const OPT_OUT_LABEL = 'no-docs';

// Fragment types that require a docs update. `Fixed` and `Security` are
// bug-class — they describe regressions or vulnerabilities, not new
// behavior to document.
const TRIGGERING_TYPES = new Set(['Added', 'Changed', 'Deprecated', 'Removed']);

const DOCS_PREFIX = 'docs/';

// Per-fragment escape hatch: any HTML comment of the form
// `<!-- docs-exempt: <reason> -->` inside the fragment body marks that
// fragment as not requiring docs. All triggering fragments must carry
// the marker for the PR to pass via this route — a paper trail per fragment.
const EXEMPT_MARKER_RE = /<!--\s*docs-exempt\b[^>]*-->/i;

function isFragmentPath(file) {
  return /^\.changeset\/[^/]+\.md$/.test(file) && !file.endsWith('/README.md');
}

function isDocsFile(file) {
  return file.startsWith(DOCS_PREFIX);
}

function isExemptFragment(fragment) {
  return EXEMPT_MARKER_RE.test(fragment.body || '');
}

/**
 * Pure verdict — no fs, no git.
 *
 * @param {object} args
 * @param {string[]} args.changedFiles  - file paths changed in the PR
 * @param {Array<{ path: string, type: string, body: string }>} args.fragments
 *   - parsed records for `.changeset/*.md` files in `changedFiles`
 * @param {string[]} args.labels        - PR labels
 * @returns {{ ok: boolean, reason: string, triggering: string[] }}
 */
function evaluateLint({ changedFiles, fragments, labels }) {
  const triggering = fragments.filter((f) => TRIGGERING_TYPES.has(f.type));
  const triggeringPaths = triggering.map((f) => f.path);

  if (triggering.length === 0) {
    return { ok: true, reason: LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS, triggering: [] };
  }

  // Per-fragment exempt path: every triggering fragment must carry the marker.
  // Partial exemption fails closed — one un-marked Added fragment still requires docs.
  if (triggering.every(isExemptFragment)) {
    return { ok: true, reason: LINT_REASON.OK_FRAGMENTS_EXEMPT, triggering: triggeringPaths };
  }

  if (labels.includes(OPT_OUT_LABEL)) {
    return { ok: true, reason: LINT_REASON.OK_OPT_OUT_LABEL, triggering: triggeringPaths };
  }

  if (changedFiles.some(isDocsFile)) {
    return { ok: true, reason: LINT_REASON.OK_DOCS_UPDATED, triggering: triggeringPaths };
  }

  return { ok: false, reason: LINT_REASON.FAIL_DOCS_MISSING, triggering: triggeringPaths };
}

function readFragmentsFromDisk(changedFiles, rootDir) {
  const fs = require('node:fs');
  const path = require('node:path');
  const out = [];
  for (const rel of changedFiles) {
    if (!isFragmentPath(rel)) continue;
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) continue; // fragment deleted in PR — skip
    let src;
    try {
      src = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const parsed = parseFragment(src);
    if (!parsed.ok) continue; // malformed — changeset lint handles it
    out.push({
      path: rel,
      type: parsed.fragment.type,
      body: parsed.fragment.body,
    });
  }
  return out;
}

function main() {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  const path = require('node:path');

  const rootDir = path.join(__dirname, '..');

  const eventPath = process.env.GITHUB_EVENT_PATH;
  let labels = [];
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      labels = (event.pull_request?.labels || []).map((l) => l.name);
    } catch { /* fall through */ }
  }

  const base = process.env.GITHUB_BASE_REF || 'main';
  let changedFiles = [];
  try {
    // execFileSync with argv — no shell, so a malicious GITHUB_BASE_REF
    // cannot inject shell syntax. Git's own ref-name validator rejects
    // any metacharacters it would otherwise interpret.
    const out = cp.execFileSync(
      'git',
      ['diff', '--name-only', `origin/${base}...HEAD`],
      { encoding: 'utf8', cwd: rootDir },
    );
    changedFiles = out.split('\n').filter(Boolean);
  } catch (e) {
    process.stderr.write(`could not compute diff: ${e.message}\n`);
    process.exit(2);
  }

  const fragments = readFragmentsFromDisk(changedFiles, rootDir);
  const verdict = evaluateLint({ changedFiles, fragments, labels });

  if (process.argv.includes('--json')) {
    process.stdout.write(
      JSON.stringify({ ...verdict, changedFiles, fragments, labels }, null, 2) + '\n',
    );
  } else if (verdict.ok) {
    process.stdout.write(`ok docs-lint: ${verdict.reason}\n`);
  } else {
    process.stderr.write(`\nERROR docs-lint: ${verdict.reason}\n`);
    process.stderr.write(
      `${verdict.triggering.length} changeset fragment(s) require documentation updates:\n`,
    );
    for (const f of fragments.filter((f) => TRIGGERING_TYPES.has(f.type))) {
      process.stderr.write(`  ${f.path}  (type: ${f.type})\n`);
    }
    process.stderr.write(`\nNo files under docs/ were modified in this PR.\n\n`);
    process.stderr.write(
      `Update the relevant docs/ file(s), or add the \`${OPT_OUT_LABEL}\` label if this change\n`,
    );
    process.stderr.write(
      `is genuinely internal-only (infrastructure, refactor, test-only). Per-fragment\n`,
    );
    process.stderr.write(
      `exemption via \`<!-- docs-exempt: <reason> -->\` inside the fragment body also works.\n`,
    );
  }
  process.exit(verdict.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = {
  evaluateLint,
  readFragmentsFromDisk,
  LINT_REASON,
  OPT_OUT_LABEL,
  TRIGGERING_TYPES,
  EXEMPT_MARKER_RE,
  isFragmentPath,
  isDocsFile,
};
