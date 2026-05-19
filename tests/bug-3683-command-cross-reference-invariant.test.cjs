// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md bodies are the deployed contract — cross-references between
// them must stay coherent. This test inspects .md source to enforce the invariant.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.resolve(__dirname, '..', 'commands', 'gsd');

function readKnownTargets() {
  const commandNames = fs.readdirSync(COMMANDS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.slice(0, -3));
  return { commandNames, knownTargets: new Set(commandNames) };
}

function stripFrontmatter(src) {
  return src.replace(/^---\r?\n[\s\S]*?\n---\r?\n/, '');
}

// Word-boundary lookbehind matching fix-slash-commands.cjs buildColonPattern / buildPattern
// Excludes path-y characters (~, ., /) so `~/gsd-workspaces`, `./gsd-foo`, `path/gsd-bar` don't match.
const REF_PATTERN = /(?<![a-zA-Z0-9_~./-])\/gsd[:-]([a-zA-Z0-9_-]+)/g;

describe('bug-3683 command cross-reference invariant', () => {
  test('all /gsd:<X> and /gsd-<X> body refs resolve to known command base-names', () => {
    const { commandNames, knownTargets: knownSet } = readKnownTargets();
    const mdFiles = commandNames.sort().map(n => path.join(COMMANDS_DIR, `${n}.md`));

    const failures = [];

    for (const filePath of mdFiles) {
      const src = fs.readFileSync(filePath, 'utf-8');
      const body = stripFrontmatter(src);
      const lines = body.split('\n');
      const relFile = path.relative(path.resolve(__dirname, '..'), filePath);

      lines.forEach((line, idx) => {
        REF_PATTERN.lastIndex = 0;
        let m;
        while ((m = REF_PATTERN.exec(line)) !== null) {
          const ref = m[1];
          if (!knownSet.has(ref)) {
            const sep = m[0].includes(':') ? ':' : '-';
            failures.push({
              file: relFile,
              line: idx + 1,
              ref: `/gsd${sep}${ref}`,
              excerpt: line.trim(),
            });
          }
        }
      });
    }

    if (failures.length > 0) {
      const msg = failures
        .map(f => `  ${f.file}:${f.line} — dangling ref "${f.ref}" — ${f.excerpt}`)
        .join('\n');
      assert.fail(`Dangling command cross-references found:\n${msg}`);
    }
  });
});
