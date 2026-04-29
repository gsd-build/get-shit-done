#!/usr/bin/env node
/**
 * lint-descriptions.cjs
 *
 * Enforces the 100-char description budget for commands/gsd/*.md files.
 *
 * Usage:
 *   node scripts/lint-descriptions.cjs [file.md ...]
 *
 * If no args are given, scans commands/gsd/ automatically.
 * Exits 1 if any description exceeds 100 chars; exits 0 if all pass.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_LENGTH = 100;
const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

/**
 * Parse the description field from frontmatter in a .md file.
 * Returns null if no description is found.
 */
function parseDescription(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];

  const quoted = fm.match(/^description:\s+"((?:[^"\\]|\\.)*)"\s*$/m);
  if (quoted) return quoted[1];

  const plain = fm.match(/^description:\s+(.+)$/m);
  if (plain) return plain[1].trim();

  return null;
}

function getFiles() {
  if (process.argv.length > 2) {
    return process.argv.slice(2);
  }
  return fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(COMMANDS_DIR, f));
}

const files = getFiles();
const violations = [];

for (const filePath of files) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`ERROR: Cannot read file: ${filePath}\n  ${err.message}\n`);
    process.exit(1);
  }

  const description = parseDescription(content);
  if (description === null) continue;

  if (description.length > MAX_LENGTH) {
    violations.push({ filePath, length: description.length, description });
  }
}

if (violations.length === 0) {
  const checked = files.length;
  process.stdout.write(`ok lint-descriptions: ${checked} file(s) checked, 0 violations\n`);
  process.exit(0);
}

process.stderr.write(`\nERROR lint-descriptions: ${violations.length} violation(s) found\n\n`);
for (const v of violations) {
  const preview = v.description.length > 120 ? v.description.slice(0, 117) + '...' : v.description;
  process.stderr.write(`  ${v.filePath}\n`);
  process.stderr.write(`    Length : ${v.length} (max ${MAX_LENGTH})\n`);
  process.stderr.write(`    Desc   : ${preview}\n\n`);
}
process.stderr.write(`Trim descriptions to <= ${MAX_LENGTH} chars. Flag docs belong in argument-hint:.\n\n`);
process.exit(1);
