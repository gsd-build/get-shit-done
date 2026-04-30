'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempDir, cleanup } = require('./helpers.cjs');

const ROOT = path.resolve(__dirname, '..');
const HOOK_PATH = path.join(ROOT, '.githooks', 'pre-push');

function writeExec(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

describe('.githooks/pre-push enterprise email guard', () => {
  test('blocks push when any to-be-pushed commit matches local blocked regex', (t) => {
    const tmpDir = createTempDir('gsd-prepush-hook-');
    t.after(() => cleanup(tmpDir));

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    writeExec(path.join(binDir, 'git'), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "rev-list" ]]; then
  echo "c1"
  echo "c2"
  exit 0
fi
if [[ "$1" == "show" ]]; then
  commit="$(printf '%s\n' "$@" | tail -n 1)"
  if [[ "$commit" == "c1" ]]; then
    echo "trekkie@nomorestars.com"
  else
    echo "person@example-corp.com"
  fi
  exit 0
fi
exit 1
`);

    assert.throws(() => {
      execFileSync('bash', [HOOK_PATH], {
        cwd: ROOT,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          GSD_BLOCKED_AUTHOR_REGEX: '@example-corp\\.com$',
        },
        input: 'refs/heads/pr refs-local-sha refs/heads/pr refs-remote-sha\n',
        stdio: 'pipe',
      });
    }, /Push blocked: commit author email matched local blocked regex/);
  });

  test('allows push when to-be-pushed commits are non-enterprise emails', (t) => {
    const tmpDir = createTempDir('gsd-prepush-hook-');
    t.after(() => cleanup(tmpDir));

    const binDir = path.join(tmpDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    writeExec(path.join(binDir, 'git'), `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "rev-list" ]]; then
  echo "c1"
  echo "c2"
  exit 0
fi
if [[ "$1" == "show" ]]; then
  echo "trekkie@nomorestars.com"
  exit 0
fi
exit 1
`);

    execFileSync('bash', [HOOK_PATH], {
      cwd: ROOT,
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        GSD_BLOCKED_AUTHOR_REGEX: '@example-corp\\.com$',
      },
      input: 'refs/heads/pr refs-local-sha refs/heads/pr refs-remote-sha\n',
      stdio: 'pipe',
    });
  });
});
