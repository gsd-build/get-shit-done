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

  // Pattern A: readFileSync(path.join(..., 'foo.cjs'), ...)
  if (READ_WITH_INLINE_CJS_RE.test(content)) {
    return {
      file: rel,
      reason: 'readFileSync with inline .cjs path literal',
      fix: 'Replace with runGsdTools() behavioral test, or add // allow-test-rule: <reason>',
    };
  }

  // Pattern B: const FOO_PATH = path.join(..., 'foo.cjs')  +  readFileSync(FOO_PATH, ...)
  const cjsConsts = setFromMatches(content, CJS_PATH_CONST_RE);
  if (cjsConsts.size > 0) {
    const readConsts = setFromMatches(content, READ_WITH_CONST_RE);
    const overlap = [...cjsConsts].filter(c => readConsts.has(c));
    if (overlap.length > 0) {
      return {
        file: rel,
        reason: `source .cjs path constant(s) used in readFileSync: ${overlap.join(', ')}`,
        fix: 'Replace with runGsdTools() behavioral test, or add // allow-test-rule: <reason>',
      };
    }
  }

  return null;
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

process.stderr.write(`\nERROR lint-no-source-grep: ${violations.length} violation(s) found\n\n`);
for (const v of violations) {
  process.stderr.write(`  ${v.file}\n`);
  process.stderr.write(`    Problem : ${v.reason}\n`);
  process.stderr.write(`    Fix     : ${v.fix}\n\n`);
}
process.stderr.write('See CONTRIBUTING.md "Prohibited: Source-Grep Tests" for guidance.\n');
process.stderr.write('Structural tests that legitimately read source files: add // allow-test-rule: <reason>\n\n');
process.exit(1);
