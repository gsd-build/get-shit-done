#!/usr/bin/env node
'use strict';

/**
 * Focused drift guard for issue #3442:
 * prevent installer-owned inline shim/wrapper text builders from bypassing the
 * Shell Command Projection Module seam.
 *
 * Scope intentionally excludes subprocess execution helpers (spawnSync /
 * execFileSync) because those are safe internal execution primitives, not
 * serialized shell-command rendering.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const targetArg = process.argv[2] || path.join(ROOT, 'bin', 'install.js');
const target = path.resolve(targetArg);
const rel = path.relative(ROOT, target);

let content;
try {
  content = fs.readFileSync(target, 'utf8');
} catch (error) {
  process.stderr.write(`lint-shell-command-projection-drift: failed to read ${target}: ${error.message}\n`);
  process.exit(1);
}

const forbidden = [
  {
    label: 'inline cmd shim builder',
    pattern: /@ECHO OFF\\r\\n@SETLOCAL\\r\\n@node /,
  },
  {
    label: 'inline pwsh shim builder',
    pattern: /#!\/usr\/bin\/env pwsh\\n& node /,
  },
  {
    label: 'inline sh shim builder',
    pattern: /#!\/usr\/bin\/env sh\\nexec node /,
  },
];

const matches = forbidden.filter((rule) => rule.pattern.test(content));
if (matches.length === 0) {
  process.stdout.write(`ok shell-projection-drift: ${rel}\n`);
  process.exit(0);
}

process.stderr.write(`ERROR shell-projection-drift: inline serialized shim builders found in ${rel}\n`);
for (const match of matches) {
  process.stderr.write(`  - ${match.label}\n`);
}
process.stderr.write('Route shim/wrapper rendering through get-shit-done/bin/lib/shell-command-projection.cjs\n');
process.stderr.write('Safe subprocess execution via spawnSync/execFileSync is intentionally allowed.\n');
process.exit(1);
