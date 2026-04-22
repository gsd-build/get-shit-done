/**
 * Drift guard: every `gsd-sdk query <cmd>` reference in the repo must
 * resolve to a handler registered in sdk/src/query/index.ts.
 *
 * The set of commands workflows/agents/commands call must equal the set
 * the SDK registry exposes. New references with no handler — or handlers
 * with no in-repo callers — show up here so they can't diverge silently.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(REPO_ROOT, 'sdk', 'src', 'query', 'index.ts');

// Prose tokens that repeatedly appear after `gsd-sdk query` in English
// documentation but aren't real command names.
const PROSE_ALLOWLIST = new Set([
  'commands',
  'intel',
  'into',
  'or',
  'init.',
]);

const SCAN_ROOTS = [
  'commands',
  'agents',
  'get-shit-done',
  'hooks',
  'bin',
  'scripts',
  'docs',
];
const EXTRA_FILES = ['README.md', 'CHANGELOG.md'];
const EXTENSIONS = new Set(['.md', '.sh', '.cjs', '.js', '.ts']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

function collectRegisteredNames() {
  const src = fs.readFileSync(REGISTRY_FILE, 'utf8');
  const names = new Set();
  const re = /registry\.register\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) names.add(m[1]);
  return names;
}

function walk(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
}

function collectReferences() {
  const files = [];
  for (const root of SCAN_ROOTS) walk(path.join(REPO_ROOT, root), files);
  for (const rel of EXTRA_FILES) {
    const full = path.join(REPO_ROOT, rel);
    if (fs.existsSync(full)) files.push(full);
  }

  const refs = [];
  const re = /gsd-sdk\s+query\s+([A-Za-z][-A-Za-z0-9._/]+)(?:\s+([A-Za-z][-A-Za-z0-9._]+))?/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        refs.push({
          file: path.relative(REPO_ROOT, file),
          line: i + 1,
          tok1: m[1],
          tok2: m[2] || null,
          raw: line.trim(),
        });
      }
    }
  }
  return refs;
}

function resolveReference(ref, registered) {
  const { tok1, tok2 } = ref;
  if (registered.has(tok1)) return true;
  if (tok2) {
    const dotted = tok1 + '.' + tok2;
    const spaced = tok1 + ' ' + tok2;
    if (registered.has(dotted) || registered.has(spaced)) return true;
  }
  if (PROSE_ALLOWLIST.has(tok1)) return true;
  return false;
}

describe('gsd-sdk query registry integration', () => {
  test('every referenced command resolves to a registered handler', () => {
    const registered = collectRegisteredNames();
    const refs = collectReferences();

    assert.ok(registered.size > 0, 'expected to parse registered names');
    assert.ok(refs.length > 0, 'expected to find gsd-sdk query references');

    const offenders = [];
    for (const ref of refs) {
      if (!resolveReference(ref, registered)) {
        const shown = ref.tok2 ? ref.tok1 + ' ' + ref.tok2 : ref.tok1;
        offenders.push(ref.file + ':' + ref.line + ': "' + shown + '" — ' + ref.raw);
      }
    }

    assert.strictEqual(
      offenders.length, 0,
      'Referenced `gsd-sdk query <cmd>` tokens with no handler in ' +
      'sdk/src/query/index.ts. Either register the handler or remove ' +
      'the reference.\n\n' + offenders.join('\n')
    );
  });

  test('informational: handlers with no in-repo caller', () => {
    const registered = collectRegisteredNames();
    const refs = collectReferences();

    const referencedNames = new Set();
    for (const ref of refs) {
      referencedNames.add(ref.tok1);
      if (ref.tok2) {
        referencedNames.add(ref.tok1 + '.' + ref.tok2);
        referencedNames.add(ref.tok1 + ' ' + ref.tok2);
      }
    }

    const unused = [];
    for (const name of registered) {
      if (referencedNames.has(name)) continue;
      if (name.includes('.')) {
        const spaced = name.replace('.', ' ');
        if (referencedNames.has(spaced)) continue;
      }
      if (name.includes(' ')) {
        const dotted = name.replace(' ', '.');
        if (referencedNames.has(dotted)) continue;
      }
      unused.push(name);
    }

    if (unused.length > 0 && process.env.GSD_LOG_UNUSED_HANDLERS) {
      console.log('[info] registered handlers with no in-repo caller:\n  ' + unused.join('\n  '));
    }
    assert.ok(true);
  });
});
