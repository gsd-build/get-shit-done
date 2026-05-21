#!/usr/bin/env node
/**
 * lint-test-file-count.cjs — max 2 test files per production module.
 *
 * Scans sdk/src/query/, sdk/src/, get-shit-done/bin/lib/, bin/ for production
 * modules, then counts matching test files in tests/ and sdk/src (recursive). Cap is 2
 * (primary + one integration). Over-limit clusters must be in the allowlist at
 * their frozen count (ratchet: may only decrease). --json emits structured output.
 *
 * Verdicts: OK_UNDER_LIMIT | OK_IN_ALLOWLIST | FAIL_EXCEEDS_LIMIT |
 *           FAIL_EXCEEDS_ALLOWLIST | HINT_CAN_REMOVE_FROM_ALLOWLIST
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROD_DIRS = [
  path.join(ROOT, 'sdk', 'src', 'query'),
  path.join(ROOT, 'sdk', 'src'),
  path.join(ROOT, 'get-shit-done', 'bin', 'lib'),
  path.join(ROOT, 'bin'),
];
const TEST_DIRS = [
  path.join(ROOT, 'tests'),
  path.join(ROOT, 'sdk', 'src'),
];
const ALLOWLIST_PATH = path.join(__dirname, 'lint-test-file-count.allowlist.json');
const MAX_FILES = 2;

const Verdict = Object.freeze({
  OK_UNDER_LIMIT:                 'OK_UNDER_LIMIT',
  OK_IN_ALLOWLIST:                'OK_IN_ALLOWLIST',
  FAIL_EXCEEDS_LIMIT:             'FAIL_EXCEEDS_LIMIT',
  FAIL_EXCEEDS_ALLOWLIST:         'FAIL_EXCEEDS_ALLOWLIST',
  HINT_CAN_REMOVE_FROM_ALLOWLIST: 'HINT_CAN_REMOVE_FROM_ALLOWLIST',
});

function isTestFile(name) {
  return name.endsWith('.test.ts') || name.endsWith('.test.cjs');
}

function listFiles(dir, pred) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && pred(e.name))
      .map(e => path.join(dir, e.name));
  } catch (_) { return []; }
}

function findTestFilesRecursive(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findTestFilesRecursive(full));
    else if (isTestFile(e.name)) out.push(full);
  }
  return out;
}

function prodPrefix(filename) {
  return filename.replace(/\.(cjs|ts|js)$/, '');
}

// Strip .test.{cjs,ts} and .integration.test.ts, then strip issue stamps.
function testEffectivePrefix(testName) {
  const bare = testName
    .replace(/\.integration\.test\.(ts|cjs)$/, '')
    .replace(/\.test\.(ts|cjs)$/, '');
  const m = bare.match(/^(?:feat|bug|enh|fix)-\d+(?:-\d+)*-(.+)$/);
  return m ? m[1] : bare;
}

function collectProdPrefixes() {
  const map = new Map();
  for (const dir of PROD_DIRS) {
    for (const f of listFiles(dir, n =>
      !isTestFile(n) &&
      !/\.(generated|md|json)(\.|$)/.test(n) &&
      /\.(ts|cjs|js)$/.test(n)
    )) {
      const prefix = prodPrefix(path.basename(f));
      if (!map.has(prefix)) map.set(prefix, f);
    }
  }
  return map;
}

function collectAllTestFiles() {
  const seen = new Set();
  const all = [];
  for (const dir of TEST_DIRS) {
    for (const f of findTestFilesRecursive(dir)) {
      if (!seen.has(f)) { seen.add(f); all.push(f); }
    }
  }
  return all;
}

function buildTestMap(prodPrefixes, allTestFiles) {
  const map = new Map([...prodPrefixes.keys()].map(p => [p, []]));
  for (const tf of allTestFiles) {
    const ep = testEffectivePrefix(path.basename(tf));
    for (const prefix of prodPrefixes.keys()) {
      if (ep === prefix || ep.startsWith(prefix + '-')) {
        map.get(prefix).push(tf);
        break;
      }
    }
  }
  return map;
}

function loadAllowlist() {
  try { return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf-8')).modules || {}; }
  catch (_) { return {}; }
}

function evaluateLint({ prefix, testFiles, allowlist }) {
  const count = testFiles.length;
  const entry = allowlist[prefix];
  const ceiling = entry ? entry.current : null;
  if (entry !== undefined) {
    if (count <= MAX_FILES)    return { verdict: Verdict.HINT_CAN_REMOVE_FROM_ALLOWLIST, prefix, count, ceiling, files: testFiles };
    if (count <= ceiling)      return { verdict: Verdict.OK_IN_ALLOWLIST,                prefix, count, ceiling, files: testFiles };
    return                            { verdict: Verdict.FAIL_EXCEEDS_ALLOWLIST,          prefix, count, ceiling, files: testFiles };
  }
  if (count <= MAX_FILES) return { verdict: Verdict.OK_UNDER_LIMIT,    prefix, count, ceiling: null, files: testFiles };
  return                         { verdict: Verdict.FAIL_EXCEEDS_LIMIT, prefix, count, ceiling: null, files: testFiles };
}

function run() {
  const jsonMode = process.argv.includes('--json');
  const prodPrefixes = collectProdPrefixes();
  const allTestFiles = collectAllTestFiles();
  const testMap      = buildTestMap(prodPrefixes, allTestFiles);
  const allowlist    = loadAllowlist();

  const results = [];
  for (const [prefix, files] of testMap) {
    if (files.length === 0) continue;
    results.push(evaluateLint({ prefix, testFiles: files, allowlist }));
  }

  const failures = results.filter(r =>
    r.verdict === Verdict.FAIL_EXCEEDS_LIMIT || r.verdict === Verdict.FAIL_EXCEEDS_ALLOWLIST);
  const hints = results.filter(r => r.verdict === Verdict.HINT_CAN_REMOVE_FROM_ALLOWLIST);

  if (jsonMode) {
    console.log(JSON.stringify({ ok: failures.length === 0, results, failures, hints }, null, 2));
    process.exit(failures.length > 0 ? 1 : 0);
  }

  if (failures.length === 0) {
    const inAllowlist = results.filter(r => r.verdict === Verdict.OK_IN_ALLOWLIST).length;
    console.log(`ok lint-test-file-count: ${results.length} module(s) checked, 0 failures` +
      (inAllowlist > 0 ? `, ${inAllowlist} allowlisted` : '') +
      (hints.length > 0 ? `, ${hints.length} hint(s)` : ''));
    for (const h of hints) {
      console.log(`  hint: "${h.prefix}" is allowlisted at ${h.ceiling} but now has ${h.count} — remove from allowlist`);
    }
    process.exit(0);
  }

  process.stderr.write(`\nERROR lint-test-file-count: ${failures.length} module(s) exceed the test-file limit\n\n`);
  for (const f of failures) {
    const tag = f.verdict === Verdict.FAIL_EXCEEDS_LIMIT
      ? `${f.count} files (limit ${MAX_FILES})`
      : `${f.count} files (allowlist ceiling ${f.ceiling})`;
    process.stderr.write(`  ${f.prefix}: ${tag}\n`);
    for (const tf of f.files) process.stderr.write(`    ${path.relative(ROOT, tf)}\n`);
  }
  process.stderr.write('\nFix: consolidate test files per module (one primary + one integration).\n');
  process.stderr.write('Or add the module to scripts/lint-test-file-count.allowlist.json with PR justification.\n\n');
  process.exit(1);
}

module.exports = {
  Verdict, evaluateLint, testEffectivePrefix, prodPrefix,
  _collectProdPrefixes: collectProdPrefixes,
  _collectAllTestFiles: collectAllTestFiles,
  _buildTestMap: buildTestMap,
  _loadAllowlist: loadAllowlist,
};

if (require.main === module) run();
