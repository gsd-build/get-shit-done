#!/usr/bin/env node
/**
 * lint-no-source-grep.cjs
 *
 * Enforces the "no source-grep tests" rule:
 *   Tests must NOT read source-code .cjs files with readFileSync to assert string
 *   presence. That pattern (source-grep theater) proves a literal exists in source,
 *   not that the runtime behavior is correct.
 *
 * ALLOWED:
 *   - require('../get-shit-done/bin/lib/foo.cjs')  -- runs the module, not text inspection
 *   - readFileSync on .md / .json / .txt files     -- product-content or config output
 *   - Files annotated: // allow-test-rule: <reason>
 *
 * DISALLOWED (without allow-test-rule):
 *   - readFileSync where the path argument ends in a .cjs filename literal
 *   - A path constant (e.g. CONFIG_PATH) assigned to a .cjs lib file, used in readFileSync
 *
 * Exit 0 = clean. Exit 1 = violations found (with diagnostics).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
const ALLOW_ANNOTATION = /\/\/\s*allow-test-rule:\s*\S/;

// Matches constant definitions that hold a .cjs path in a SOURCE directory.
// Requires a source-dir indicator ('bin', 'lib', 'get-shit-done') to avoid
// flagging temp files like path.join(tmpDir, 'example.cjs').
//   const CONFIG_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config-schema.cjs');
const CJS_PATH_CONST_RE = /(?:const|let|var)\s+(\w+)\s*=\s*path\.join\s*\([^)]*(?:'bin'|"bin"|'lib'|"lib"|'get-shit-done'|"get-shit-done")[^)]*['"][^'"]*\.cjs['"]/gm;

// Matches readFileSync with a named variable as first arg
const READ_WITH_CONST_RE = /readFileSync\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,/gm;

// Matches readFileSync with an inline path.join(.cjs) as first arg
const READ_WITH_INLINE_CJS_RE = /readFileSync\s*\([^,)]*path\.join\s*\([^)]*(?:'bin'|"bin"|'lib'|"lib"|'get-shit-done'|"get-shit-done")[^)]*['"][^'"]*\.cjs['"]/;

/**
 * #2962-class violations: raw text matching against process output or file
 * content. The rule from CONTRIBUTING.md "Prohibited: Raw Text Matching on
 * Test Outputs": tests assert on typed structured fields, never on rendered
 * text. Patterns below are the obvious anti-patterns; subtler hidden forms
 * (e.g. wrapping the same logic in a parser function) are still forbidden
 * by the prose rule but cannot be detected lexically without an AST.
 */
const RAW_MATCH_PATTERNS = [
  {
    re: /assert\.(?:match|doesNotMatch)\s*\(\s*[A-Za-z_$][A-Za-z0-9_$]*\.(?:stdout|stderr)\b/,
    label: 'assert.match/doesNotMatch on .stdout/.stderr (emit --json from the SUT and assert on typed fields)',
  },
  {
    re: /\.(?:stdout|stderr)\.(?:includes|startsWith|endsWith)\s*\(/,
    label: '.stdout/.stderr substring match (emit --json and assert on typed fields)',
  },
  {
    re: /readFileSync\s*\([^)]*\)\s*\.(?:includes|startsWith|endsWith)\s*\(/,
    label: 'readFileSync(...).<includes|startsWith|endsWith> (expose an IR from production code; assert on its fields)',
  },
];

function setFromMatches(content, re) {
  const found = new Set();
  let m;
  const cloned = new RegExp(re.source, re.flags);
  while ((m = cloned.exec(content)) !== null) found.add(m[1]);
  return found;
}

function check(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const rel = path.relative(path.join(__dirname, '..'), filepath);

  if (ALLOW_ANNOTATION.test(content)) return null;

  const violations = [];

  // Pattern A: readFileSync(path.join(..., 'foo.cjs'), ...)
  if (READ_WITH_INLINE_CJS_RE.test(content)) {
    violations.push({
      reason: 'readFileSync with inline .cjs path literal',
      fix: 'Replace with runGsdTools() behavioral test, or add // allow-test-rule: <reason>',
    });
  }

  // Pattern B: const FOO_PATH = path.join(..., 'foo.cjs')  +  readFileSync(FOO_PATH, ...)
  const cjsConsts = setFromMatches(content, CJS_PATH_CONST_RE);
  if (cjsConsts.size > 0) {
    const readConsts = setFromMatches(content, READ_WITH_CONST_RE);
    const overlap = [...cjsConsts].filter(c => readConsts.has(c));
    if (overlap.length > 0) {
      violations.push({
        reason: `source .cjs path constant(s) used in readFileSync: ${overlap.join(', ')}`,
        fix: 'Replace with runGsdTools() behavioral test, or add // allow-test-rule: <reason>',
      });
    }
  }

  // Patterns C..E: raw text matching against process output or file content.
  // See CONTRIBUTING.md "Prohibited: Raw Text Matching on Test Outputs".
  for (const { re, label } of RAW_MATCH_PATTERNS) {
    if (re.test(content)) {
      violations.push({
        reason: label,
        fix: 'Expose typed IR from production code; assert on structured fields. Or add // allow-test-rule: <reason>',
      });
    }
  }

  // Patterns F..G (#2982): var-binding readFileSync().<text-method>() and
  // assert.ok(<expr>.match(...)). These escape the simpler patterns above
  // because the bind and the use are on different lines or wrapped.
  const extras = require('./lint-no-source-grep-extras.cjs');
  const varBindFindings = extras.detectVarBindingViolations(content);
  if (varBindFindings.length > 0) {
    const samples = varBindFindings.slice(0, 3)
      .map((f) => `${f.variable}.${f.method}()`)
      .join(', ');
    violations.push({
      reason: `readFileSync-bound variable used in text-match method: ${samples}${varBindFindings.length > 3 ? `, …+${varBindFindings.length - 3} more` : ''}`,
      fix: 'Expose typed IR; assert on structured fields. Or // allow-test-rule: <reason>',
    });
  }
  const wrappedFindings = extras.detectWrappedAssertOkMatch(content);
  if (wrappedFindings.length > 0) {
    violations.push({
      reason: `assert.ok(<expr>.match(...)) — escapes assert.match rule (${wrappedFindings.length} occurrence${wrappedFindings.length > 1 ? 's' : ''})`,
      fix: 'Use assert.equal on a typed field, not regex match on text. Or // allow-test-rule: <reason>',
    });
  }

  if (violations.length === 0) return null;
  return { file: rel, violations };
}

function findTestFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (entry.name.endsWith('.test.cjs')) {
      results.push(full);
    }
  }
  return results;
}

const testFiles = findTestFiles(TESTS_DIR);

const violations = testFiles.map(check).filter(Boolean);

if (violations.length === 0) {
  console.log(`ok lint-no-source-grep: ${testFiles.length} test files checked, 0 violations`);
  process.exit(0);
}

const totalIssues = violations.reduce((n, v) => n + v.violations.length, 0);
process.stderr.write(`\nERROR lint-no-source-grep: ${totalIssues} violation(s) across ${violations.length} file(s)\n\n`);
for (const f of violations) {
  process.stderr.write(`  ${f.file}\n`);
  for (const v of f.violations) {
    process.stderr.write(`    Problem : ${v.reason}\n`);
    process.stderr.write(`    Fix     : ${v.fix}\n`);
  }
  process.stderr.write('\n');
}
process.stderr.write('See CONTRIBUTING.md "Prohibited: Source-Grep Tests" and\n');
process.stderr.write('"Prohibited: Raw Text Matching on Test Outputs" for guidance.\n');
process.stderr.write('Structural tests that legitimately read source files: add // allow-test-rule: <reason>\n\n');
process.exit(1);
