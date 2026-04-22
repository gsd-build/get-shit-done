'use strict';
/**
 * One-shot script: replace /gsd-<cmd> with /gsd:<cmd> for known command names.
 * Only replaces when followed by a word boundary (space, newline, quote, backtick, ), end).
 */

const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const cmdNames = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace(/\.md$/, ''))
  .sort((a, b) => b.length - a.length); // longest first to avoid partial matches

// Build regex: /gsd-(cmd1|cmd2|...) followed by non-word-char or end
const pattern = new RegExp(`/gsd-(${cmdNames.join('|')})(?=[^a-zA-Z0-9_-]|$)`, 'g');

const SEARCH_DIRS = [
  path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib'),
  path.join(__dirname, '..', 'get-shit-done', 'workflows'),
  path.join(__dirname, '..', 'get-shit-done', 'references'),
  path.join(__dirname, '..', 'get-shit-done', 'templates'),
  path.join(__dirname, '..', 'get-shit-done', 'contexts'),
  path.join(__dirname, '..', 'commands', 'gsd'),
];
const EXTENSIONS = new Set(['.md', '.cjs', '.js']);

function processDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      processDir(full);
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      const src = fs.readFileSync(full, 'utf-8');
      const replaced = src.replace(pattern, (_, cmd) => `/gsd:${cmd}`);
      if (replaced !== src) {
        fs.writeFileSync(full, replaced, 'utf-8');
        const count = (src.match(pattern) || []).length;
        console.log(`  ${count} replacements: ${path.relative(path.join(__dirname, '..'), full)}`);
      }
    }
  }
}

let totalFiles = 0;
for (const dir of SEARCH_DIRS) {
  processDir(dir);
}
console.log('Done.');
